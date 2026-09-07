# 10 — Api: host, versionado y catálogo de endpoints

Este documento describe la **infraestructura HTTP** del host **`EcuNexo.Api`** y el **catálogo completo de rutas** actuales: propósito, comportamiento esperado y **de qué depende** cada una (middleware, comandos, persistencia, autorización provisional).

> **Versión de API en URL**: todas las rutas versionadas bajo `/api/v1/...` (segmento `v1` vía `Asp.Versioning` + `UrlSegmentApiVersionReader`).  
> Detalle de política, carpetas `Endpoints/V1`–`V2` y cómo introducir una versión nueva: **[`16-api-versionamiento.md`](16-api-versionamiento.md)**.

---

## 1. Infraestructura común (de lo que dependen casi todos)

| Pieza | Ubicación / registro | Efecto |
|---|---|---|
| **Cadena PostgreSQL** | `Program.cs` → `AddData(connectionString)`; `appsettings.json` → `ConnectionStrings:Default` | Sin conexión la Api no arranca. |
| **Capa Business** | `AddBusiness()` — handlers CQRS, **`ISender`**, validadores FluentValidation, `IPolicyEvaluator`, `IPermissionAccessGuard` | Los endpoints invocan casos de uso vía **`ISender.SendAsync<TCommand,TResponse>`** (el handler concreto se resuelve en DI). |
| **Capa Data** | `AddData` — `EcuNexoDbContext`, repositorios, `ITenantContext` scoped, `IUnitOfWork` | Persistencia EF Core + filtros multi-tenant. |
| **`Jwt` + `AddEcuNexoJwt`** | `Program.cs` → `AddEcuNexoJwt(configuration)`; `appsettings.json` → sección **`Jwt`** (`Issuer`, `Audience`, `SigningKey` ≥32 caracteres) | **JWT Bearer** (HMAC). Validación de emisor, audiencia, firma y caducidad. En producción, **`SigningKey`** vía variables de entorno (p. ej. `Jwt__SigningKey`). |
| **`ActivationCodes` + pepper** | `appsettings.json` → **`ActivationCodes:Pepper`**; `Program.cs` → `Configure<ActivationCodeOptions>` + `IActivationCodePepperProvider` | Secreto de servidor para **huella** de códigos de activación (ver doc **14**). En Development suele sobreescribirse en `appsettings.Development.json`. |
| **`UseAuthentication` / `UseAuthorization`** | `Program.cs` — **antes** de `TenantResolutionMiddleware` | El pipeline establece `HttpContext.User` a partir del encabezado **`Authorization: Bearer …`**. Sin token, los endpoints siguen pudiendo usar cabeceras `X-EcuNexo-*` donde aplique. |
| **OpenAPI — esquema Bearer** | `BearerSecuritySchemeTransformer` registrado en `AddOpenApi` | En **`/openapi/v1.json`** aparece el esquema de seguridad HTTP **Bearer** para usar en Scalar u otros clientes. |
| **`TenantResolutionMiddleware`** | `Program.cs` — **después** de `UseAuthentication` / `UseAuthorization`, **antes** de los endpoints | Si la ruta incluye **`tenantId`**, fija `ITenantContext.SetCurrentTenant` → filtros EF y guard usan ese tenant. Rutas **sin** `tenantId` dejan `CurrentTenantId` en **null** (salvo claim `tid` o cabecera; ver doc **12**). |
| **`ICallerContext` / `HttpCallerContext`** | `AddHttpContextAccessor` + scoped `HttpCallerContext` | **`UserId`** y **`ExplicitTenantId`** desde JWT (`sub`, `tid`) si el usuario está autenticado; si no, desde cabeceras `X-EcuNexo-*`. |
| **`ISender` / `Sender`** | `EcuNexo.Business` — registrado scoped en `AddBusiness` | **`SendAsync<TCommand,TResponse>`** → `ICommandHandler<,>`; **`AskAsync<TQuery,TResponse>`** → `IQueryHandler<,>` (lecturas sin efectos de dominio). |
| **OpenAPI + Scalar** | `Program.cs` → `AddOpenApi()`, `MapOpenApi()`, `MapScalarApiReference()` | Documento **`GET /openapi/v1.json`**; UI **`GET /scalar/v1`** (explorador; depende del paquete **Scalar.AspNetCore**). Útil en Development; en producción restringe o desactiva si procede. |
| **Paquetes solo Api** | `Microsoft.AspNetCore.OpenApi`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Scalar.AspNetCore` (+ versioning ya existente) | OpenAPI 3 + autenticación JWT + explorador Scalar. |
| **Mapeo errores HTTP** | `Extensions/ResultHttpExtensions.cs` | `ErrorType` → códigos **400 / 401 / 403 / 404 / 409 / 500** y ProblemDetails. |
| **OpenAPI tag** | Cada grupo: `Tenancy` o `Identity` | Agrupación en el documento OpenAPI y en Scalar. |
| **Seeds Development** | `Program.cs` — **antes** de `RunAsync`, en este orden: `DevelopmentActivationCodeSeeder.EnsureAsync`, `DevelopmentCatalogSeeder.EnsureSeedAsync`, `MenuCatalogSeeder.EnsureAsync`, `PlatformSettingsSeeder.EnsureAsync` | Códigos de activación, tenant demo si no hay tenants, **catálogo menú** (`platform.menu_items`) + permisos facturación, settings globales. |

> **Autenticación JWT**: el host valida **Bearer** y rellena `ICallerContext` desde claims cuando `User` está autenticado (`sub` / `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier` → usuario; claim **`tid`** → tenant explícito; ver `JwtClaimTypes`). Si no hay JWT válido, **`HttpCallerContext`** sigue aceptando las cabeceras `X-EcuNexo-*` (doc **12**). No hay `RequireAuthorization()` global: los endpoints sensibles usan **`IPermissionAccessGuard`** (y filtros) o quedan públicos a propósito (bootstrap).

---

## 2. Catálogo de endpoints

Convenciones en la columna **Depende de** (lista no exhaustiva pero orientativa):

- **Middleware**: resolución de tenant por ruta.
- **CQRS**: **`ISender`** despacha `ICommandHandler<,>` (`SendAsync`) o `IQueryHandler<,>` (`AskAsync`).
- **BD**: transacciones vía `IUnitOfWork.SaveChangesAsync` dentro del handler correspondiente.
- **JWT / cabeceras**: `Authorization: Bearer …` o `X-EcuNexo-*` según doc **12**.
- **Filtro**: `PermissionFilters.Require(...)` antes del handler.

| Método | Ruta | Propósito | Descripción | Depende de |
|---|---|---|---|---|
| `GET` | `/` | Comprobación mínima de vida del servicio | Respuesta JSON `{ service, status }`. No versionada; apta como health ligero. | Ninguna capa de negocio ni BD. |
| `GET` | `/openapi/v1.json` | Documento **OpenAPI 3** (esquema de la API v1) | Generado en runtime por **Microsoft.AspNetCore.OpenApi**; consume metadatos de endpoints y `Asp.Versioning`. | `AddOpenApi` + `MapOpenApi`; sin negocio de dominio. |
| `POST` | `/api/v1/auth/login` | **Login productivo** | Cuerpo: `email`, `password`, `tenantId?`. Resuelve titular de licencia (`subscription_accounts`) o usuario tenant. Emite JWT con `sub`; titular sin `tid` (`isSubscriptionHolder: true`). **401** genérico si falla. | `LoginHandler` + `IJwtAccessTokenFactory`. Público. |
| `POST` | `/api/v1/onboarding/activate-license` | **Canje comercial (recomendado)** | Cuerpo: `activationCode`, `licenseArtifact`. Verifica firma RSA + hash de validación. Primera vez: crea **`subscription_accounts`** + `license_redemptions`. Re-canje: login titular. **200** `{ accessToken, expiresAt, userId, tenantId: null, isSubscriptionHolder: true }`. | `ActivateLicenseHandler`. Público. Ver **14** y **`platform-licensing/10`**. |
| `GET` | `/api/v1/subscription/session` | **Handshake titular** | Usuario titular autenticado: `user`, `subscription`, `permissions[]` (tenancy.*), `settings`, `navigation` (contexto **Subscription**), `permVersion`, `isSubscriptionHolder: true`. | `GetSubscriptionSessionHandler`. **Bearer** titular. |
| `GET` | `/api/v1/subscription/companies` | **Listar empresas de la licencia** | Cupo usado/máximo (excluye canceladas), lista de tenants del `subscription_group_id`. Permiso `tenancy.tenants.read`. | `ListSubscriptionCompaniesHandler`. **Bearer** titular. |
| `POST` | `/api/v1/subscription/companies` | **Provisionar empresa** | Cuerpo: datos tenant + admin. Crea tenant, rol Administrador (permisos **filtrados por módulos** de la licencia), usuario admin. **201** `{ tenantId, userId, roleId }`. Permiso `tenancy.tenants.create`. | `ProvisionSubscriptionCompanyHandler`. **Bearer** titular. |
| `POST` | `/api/v1/subscription/companies/{tenantId}/session` | **Entrar a empresa** | Valida pertenencia al grupo de suscripción; busca usuario tenant con el **email del titular**; emite JWT tenant. **200** `{ accessToken, userId, tenantId, isSubscriptionHolder: false }`. | `SwitchToCompanySessionHandler`. **Bearer** titular. |
| `DELETE` | `/api/v1/subscription/companies/{tenantId}` | **Eliminar empresa (lógico)** | Estado `Cancelled`: deja de listarse y **libera cupo**. Permiso `tenancy.tenants.delete`. | `CancelSubscriptionCompanyHandler`. |
| `POST` | `/api/v1/auth/dev-token` | **Solo Development**: obtener JWT de prueba | Cuerpo: `userId`, `tenantId` (obligatorio). Respuesta: `accessToken`, `expiresAt`. | `DevAuthEndpoints` + `IJwtAccessTokenFactory`. |
| `GET` | `/api/v1/tenants/{tenantId}/session` | **Handshake SPA** | Usuario autenticado: `user`, `tenant`, `permissions[]`, `settings`, `navigation`, `menuContexts[]`, `permVersion`. | `GetSessionHandler` + `ISettingsResolver` + `IMenuNavigationBuilder` (BD `platform.menu_items`, fallback JSON). **Bearer** requerido. |
| `GET` | `/api/v1/tenants/{tenantId}/menu?context=` | Menú filtrado por contexto | `operational` (default) o `configuration`. Respuesta: `items`, `availableContexts`, `context`. | `GetTenantMenuHandler` + `IMenuNavigationBuilder`. **Bearer** requerido. |
| `GET/POST/PUT/DELETE` | `/api/v1/platform/menu-items` | CRUD catálogo menú SPA | Superadmin platform. Permiso `platform.menu.manage`. | `IMenuItemRepository` + esquema `platform`. |
| `GET` | `/api/v1/settings` | Settings consolidados del caller | Merge global → plan → tenant → user. Permiso `platform.settings.read`. | `GetResolvedSettingsHandler` + `ISettingsResolver`. **Bearer**. |
| `PUT` | `/api/v1/settings/ui` | Guardar preferencias UI del usuario | Cuerpo: `maxRecords`, `palette`, `density`, `startDarkMode`, `defaultLookback` (`1m` \| `3m` \| `6m` \| `1y`). Upsert scope **User** (códigos `ui.grid.max_records`, `ui.theme.palette`, `ui.density`, `ui.start_dark`, `ui.grid.default_lookback`). Responde settings resueltos. Permiso `platform.settings.update`. | `UpsertUserUiPreferencesHandler`. **Bearer**. |
| `GET` | `/api/v1/tenants/{tenantId}/settings` | Settings consolidados | Merge global → plan → tenant → user. Permiso `platform.settings.read`. | `GetResolvedSettingsHandler` + `ISettingsResolver`. **Bearer**. |
| `POST` | `/api/v1/tenants/{tenantId}/authorization/evaluate` | ABAC + acciones UI | Cuerpo: `permission`. Respuesta: `granted`, `deniedReason?`, `allowedActions[]`. | `EvaluateAuthorizationHandler`. **Bearer** requerido. |
| `POST` | `/api/v1/onboarding/tenant-with-activation` | **Alta inicial con código de activación** | Cuerpo: `activationCode`, `tenantName`, `ownerEmail`, `ownerName` y opcionales de tenant/usuario (branding, `timeZoneId`, `locale`, etc.). Valida código en `tenancy.activation_codes`, crea **tenant** con entitlements (`subscription_max_tenants`, `enabled_modules`), rol **Administrador** con todos los **permisos activos**, **primer usuario** y asignación. **201** + `Location` al tenant; cuerpo: `tenantId`, `userId`, `roleId`. | `ISender` → `OnboardTenantWithActivationHandler` + repos + `IUnitOfWork`. **Sin** `tenantId` en ruta. Detalle y modelo de datos: doc **14**. |
| `POST` | `/api/v1/tenants` | Crear **tenant** (organización cliente) | Cuerpo: `name`, `servicePlanName`, `maxUsers`, `maxWarehouses` y, opcionales para UI/branding: `displayName?`, `timeZoneId?` (IANA), `locale?` (BCP 47), `logoUrl?`, `primaryColorHex?` (`#RGB` / `#RRGGBB`). Crea fila en `tenancy.tenants`. Responde **201** + `Location`. | `ISender` → `CreateTenantHandler` + `ITenantRepository` + `IUnitOfWork`. **Sin** `tenantId` en ruta → `ITenantContext` suele ir null durante la petición. |
| `POST` | `/api/v1/tenants/{tenantId}/users` | Crear **usuario** en el tenant | Cuerpo: `email`, `name`, `department?`, `phone?`, `jobTitle?`. Email único por tenant. **201** + `Location`. | Middleware **tenant** (`tenantId`). `ISender` → `CreateUserHandler` + repos + `IUnitOfWork`. |
| `POST` | `/api/v1/tenants/{tenantId}/roles` | Crear **rol** (RBAC tenant-scoped) | Cuerpo: `name`, `description?`, `isSystem?` (default `false`). Nombre único por tenant (reglas en dominio). **201** + `Location`. | Middleware **tenant**. `ISender` → `CreateRoleHandler` + `IRoleRepository` + `IUnitOfWork`. |
| `POST` | `/api/v1/tenants/{tenantId}/users/{userId}/roles` | **Asignar** rol a usuario | Cuerpo: `roleId`. Vincula `UserRole`. **201** + `Location`. | Middleware **tenant**. `ISender` → `AssignUserRoleHandler` + repos + `IUnitOfWork`. |
| `POST` | `/api/v1/tenants/{tenantId}/roles/{roleId}/permissions` | **Otorgar** permiso global a un rol | Cuerpo: `permissionId`. Inserta `RolePermission`. **201** + `Location`. | Middleware **tenant**. `ISender` → `GrantRolePermissionHandler` + repos + `IUnitOfWork`. |
| `POST` | `/api/v1/permissions` | Crear **permiso** de catálogo global | Cuerpo: `code`, `description?`, `displayName?`, `module?`, `sortOrder?` (default `0`). Código normalizado en dominio (minúsculas, puntos). **201** + `Location`. | `ISender` → `CreatePermissionHandler` + `IPermissionRepository` + `IUnitOfWork`. **Sin** tenant en ruta. |
| `POST` | `/api/v1/permissions/{permissionId}/policies` | Crear **política ABAC** sobre un permiso | Cuerpo: `effect` (`Allow`/`Deny`), `condition?` (expresión DynamicExpresso, variable `ctx`). **201** + `Location`. | **Filtro** `PermissionFilters.Require("identity.policies.manage")` → `IPermissionAccessGuard` + RBAC + políticas Deny. **Cabeceras** típicas: `X-EcuNexo-User-Id`, `X-EcuNexo-Tenant-Id`. Luego `ISender` → `CreatePolicyHandler` + `IPolicyEvaluator` + `IUnitOfWork`. |
| `GET` | `/api/v1/tenants/{tenantId}` | **Consultar** tenant | **200** JSON: `id`, `name`, perfil UI (`displayName`, `timeZoneId`, `locale`, `logoUrl`, `primaryColorHex`), `status`, plan (`servicePlanName`, `maxUsers`, `maxWarehouses`), `createdAt` / `updatedAt`. **404** si no existe. | `AskAsync` → `GetTenantByIdHandler` + `ITenantRepository`. Middleware **tenant**. |
| `GET` | `/api/v1/tenants/{tenantId}/users` | **Listar** usuarios activos del tenant | Lista ordenada por nombre: `id`, `email`, `name`, `department`, `phone`, `jobTitle`, `lastLoginAt`, `createdAt`. | `AskAsync` → `ListTenantUsersHandler` + `IUserRepository`. Middleware **tenant**. |
| `GET` | `/api/v1/tenants/{tenantId}/users/{userId}` | **Detalle** de usuario | Incluye `phone`, `jobTitle`, `lastLoginAt`, `roleIds` y `effectivePermissionCodes` (RBAC vía roles). **404** si no existe. | `AskAsync` → `GetTenantUserHandler` + repos + `IUserPermissionQuery`. |
| `GET` | `/api/v1/tenants/{tenantId}/roles` | **Listar** roles activos | `id`, `name`, `description`, `isSystem`, `createdAt`. | `AskAsync` → `ListTenantRolesHandler` + `IRoleRepository`. |
| `GET` | `/api/v1/tenants/{tenantId}/roles/{roleId}` | **Detalle** de rol | `description`, `isSystem`, `permissionIds` otorgados al rol, `createdAt` / `updatedAt`. **404** si no existe. | `AskAsync` → `GetTenantRoleHandler` + `IRolePermissionRepository`. |
| `GET` | `/api/v1/permissions` | **Listar** permisos del catálogo (no eliminados) | Ordenados por `code`: `id`, `code`, `displayName`, `module`, `sortOrder`, `description`, `status`, `createdAt`. Sin `tenantId` en ruta. | `AskAsync` → `ListPermissionsHandler` + `IPermissionRepository`. |
| `GET` | `/api/v1/permissions/{permissionId}` | **Detalle** de permiso | Incluye `displayName`, `module`, `sortOrder` además de `code`, `description`, `status`, fechas. **404** si está borrado o no existe. | `AskAsync` → `GetPermissionByIdHandler`. |
| `GET` | `/api/v1/permissions/{permissionId}/policies` | **Listar** políticas ABAC del permiso | **Filtro** `identity.policies.manage` (igual que el `POST`). Orden: `createdAt`, `id`. | `AskAsync` → `ListPermissionPoliciesHandler`. |
| `GET` | `/api/v1/tenants/{tenantId}/authorization/verify` | **Diagnosticar** si el llamante tendría acceso a un permiso | Query obligatorio: `permission` (código). Respuesta **200** `{ granted: true, permission }` o error Problem (`401`/`403`/`404`/…). | Middleware **tenant**. `IPermissionAccessGuard` + `PolicyEvaluationContextFactory`. |

---

## 3. Contratos de cuerpo (referencia rápida)

| Endpoint | JSON (camelCase típico) |
|---|---|
| `POST .../onboarding/tenant-with-activation` | `activationCode`, `tenantName`, `ownerEmail`, `ownerName`, `tenantDisplayName?`, `timeZoneId?`, `locale?`, `logoUrl?`, `primaryColorHex?`, `ownerDepartment?`, `ownerPhone?`, `ownerJobTitle?` |
| `POST .../tenants` | `name`, `servicePlanName`, `maxUsers`, `maxWarehouses`, `displayName?`, `timeZoneId?`, `locale?`, `logoUrl?`, `primaryColorHex?` |
| `POST .../users` | `email`, `name`, `department?`, `phone?`, `jobTitle?` |
| `POST .../roles` | `name`, `description?`, `isSystem?` |
| `POST .../users/{userId}/roles` | `roleId` |
| `POST .../roles/{roleId}/permissions` | `permissionId` |
| `POST .../permissions` | `code`, `description?`, `displayName?`, `module?`, `sortOrder?` |
| `POST .../dev-token` (solo Dev) | `userId`, `tenantId?` |
| `POST .../policies` | `effect`, `condition?` |

Las respuestas **GET** reflejan los records de los handlers (p. ej. `GetTenantByIdResponse`, `UserListItemResponse`, `PermissionListItemResponse`); la serialización JSON es **camelCase**. Detalle en **`/openapi/v1.json`**.

Archivos fuente: `src/EcuNexo.Api/Contracts/V1/**/*.cs`.

---

## 4. Archivos de rutas

| Área | Archivo |
|---|---|
| Seguridad JWT + OpenAPI Bearer | `Security/JwtOptions.cs`, `JwtServiceCollectionExtensions.cs`, `JwtClaimTypes.cs`, `BearerSecuritySchemeTransformer.cs`, `HttpCallerContext.cs` |
| Tenancy | `Endpoints/V1/Tenancy/TenantEndpoints.cs`, `OnboardingEndpoints.cs` |
| Suscripción (titular) | `Endpoints/V1/Subscription/SubscriptionEndpoints.cs` |
| Seeds Development | `Development/DevelopmentActivationCodeSeeder.cs`, `Development/DevelopmentCatalogSeeder.cs` |
| Opciones código de activación | `Configuration/ActivationCodeOptions.cs`, `Tenancy/ActivationCodePepperProvider.cs` |
| Identity — usuarios / roles / permisos | `Endpoints/V1/Identity/UserEndpoints.cs`, `RoleEndpoints.cs`, `PermissionEndpoints.cs` |
| Identity — auth local (solo Development) | `Endpoints/V1/Auth/DevAuthEndpoints.cs` |
| Identity — verificación autorización | `Endpoints/V1/Identity/AuthorizationEndpoints.cs` |

> 📚 **Onboarding y licencias comerciales**: **`14-onboarding-y-codigos-activacion.md`**, **`platform-licensing/10-modelo-titular-suscripcion-rbac.md`**, **`platform-licensing/09-seguridad-licencias-desacopladas.md`**.

---

## 2b. Plano suscripción vs plano tenant (resumen)

| Aspecto | Titular (`/subscription/*`) | Empresa (`/tenants/{tenantId}/*`) |
|---|---|---|
| JWT | `pk=subscription`, sin `tid` | `sub` + `tid` |
| Menú SPA | Contexto **Subscription** (Inicio, Empresas, Plan) | Contexto **Operational** (Equipo, módulos, etc.) |
| Permisos API | `tenancy.tenant.read`, `tenancy.tenants.read`, `tenancy.tenants.create`, `tenancy.tenants.delete` | RBAC + `ModuleEntitlementGuard` + ABAC Deny |
| Crear usuarios/roles | No (requiere tenant) | Sí, vía Identity |

Tras **`POST /subscription/companies/{tenantId}/session`**, el SPA debe usar **`GET /tenants/{tenantId}/session`** para el handshake operativo.

---

## 5. Probar en local

1. Migraciones: `dotnet ef database update --project src/EcuNexo.Data --startup-project src/EcuNexo.Api`
2. Arrancar: `dotnet run --project src/EcuNexo.Api`
3. **Development — canje comercial (recomendado)**: emitir licencia desde `ecunexo_license_api` (puerto 5090) o usar artefacto de prueba; `POST /api/v1/onboarding/activate-license` con `activationCode` + `licenseArtifact`. Luego `GET /api/v1/subscription/session` y crear empresas con `POST /api/v1/subscription/companies`. Ver **`platform-licensing/10`**.
4. **Development — legacy `tenant-with-activation`**: código **`DEV-ECUNEXO-ACTIVATION`** en tabla `activation_codes` vacía (ver **14**).
5. **Development — tenant demo**: si **no hay ningún tenant**, seed **Everchic Demo** + **`superusuario.seed@ecunexo.local`**. Si ya existen tenants, ese seed no corre.
6. Ejemplo crear tenant manual — **sin** código de activación:

```http
POST /api/v1/tenants
Content-Type: application/json

{
  "name": "Mi empresa",
  "servicePlanName": "Starter",
  "maxUsers": 10,
  "maxWarehouses": 3,
  "displayName": "Mi marca",
  "timeZoneId": "America/Guayaquil",
  "locale": "es-EC",
  "primaryColorHex": "#2563eb"
}
```

Errores de validación/negocio → ProblemDetails según `ResultHttpExtensions`.

5b. **Onboarding con código de activación** (detalle en **14**):

```http
POST /api/v1/onboarding/tenant-with-activation
Content-Type: application/json

{
  "activationCode": "DEV-ECUNEXO-ACTIVATION",
  "tenantName": "Mi Ferretería",
  "ownerEmail": "dueño@miempresa.com",
  "ownerName": "María Dueña",
  "timeZoneId": "America/Guayaquil",
  "locale": "es-EC",
  "primaryColorHex": "#2563eb"
}
```

6. **Token de prueba (Development)** — en el cuerpo usa el `tenantId` del demo y el **`userId`** del usuario seed (en el JSON de listado de usuarios el campo es **`id`**, no `userId`). Si acabas de hacer seed de catálogo: **`superusuario.seed@ecunexo.local`**. Ejemplo de flujo:

```http
POST /api/v1/auth/dev-token
Content-Type: application/json

{
  "userId": "00000000-0000-0000-0000-000000000001",
  "tenantId": "00000000-0000-0000-0000-000000000002"
}
```

Luego, por ejemplo:

```http
GET /api/v1/tenants/00000000-0000-0000-0000-000000000002/authorization/verify?permission=identity.policies.manage
Authorization: Bearer <accessToken>
```

7. Documentación interactiva: **`http://localhost:<puerto>/scalar/v1`** (ajusta el puerto según `launchSettings.json`); el esquema está en **`/openapi/v1.json`** (incluye seguridad **Bearer** para pegar el JWT en Scalar).

---

## 6. Qué sigue (mejoras)

- **SignalR** por tenant (`ui.realtime.enabled` en settings; ver ADR-007).
- **CRUD** de `platform.sys_settings` para administradores.
- Tabla **`plans`** si el scope plan deja de usar `ServicePlan.Name` como clave.
- **Proteger o desactivar** `/openapi/v1.json` y `/scalar/v1` en producción según política de seguridad.
- **Behaviors** sobre `ISender` (logging, métricas, transacción explícita) sin inflar cada handler.
- **422** para validación si se prefiere sobre **400** (RFC 4918); hoy **Validation** → **400**.

> 📚 Modelo Identity, RBAC, ABAC y cabeceras: **`11-identity-multitenant-rbac.md`**, **`12-policy-abac-fundamentos.md`**. Onboarding y licencias: **`14-onboarding-y-codigos-activacion.md`**. Versionamiento HTTP: **`16-api-versionamiento.md`**.

> 📚 Skills: `ecunexo-architecture`, `ecunexo-coding-standards`.
