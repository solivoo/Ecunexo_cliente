# 11 — Identity: usuarios, roles, permisos y aislamiento multi-tenant

Este capítulo registra **lo que ya está en el código**: modelo de dominio, persistencia, filtros EF por tenant, middleware y **todos los endpoints HTTP** del contexto Identity relacionados con RBAC. Úsalo como guía de estudio y mapa de archivos.

> 💡 **Orden sugerido de lectura**: primero tablas de “Qué existe”, luego “Flujo de una petición”, al final “Migraciones” y “Pendientes”.

> 📚 **Vista de base de datos** (esquemas `tenancy` / `identity`, lista de tablas en DBeaver): doc **13**.

---

## 1. Qué problema resuelve

| Necesidad | Cómo se cubre en el código |
|---|---|
| Un **usuario** pertenece a **un tenant** | `User.TenantId` + FK a `tenancy.tenants` |
| **Roles** distintos por tenant | `Role.TenantId` + índice único `(tenant_id, name)` con soft-delete |
| **Permisos** reutilizables entre tenants | `Permission` **sin** `TenantId` (catálogo global) |
| Usuario tiene varios roles | `UserRole` PK `(TenantId, UserId, RoleId)` |
| Rol incluye varios permisos | `RolePermission` PK `(RoleId, PermissionId)` |
| Aislamiento en lecturas EF | `HasQueryFilter` en `EcuNexoDbContext` + `ITenantContext` |

---

## 2. Entidades en `EcuNexo.Core` (`src/EcuNexo.Core/Identity/`)

| Tipo | Archivo | Notas |
|---|---|---|
| `Email` | `Email.cs` | VO: correo normalizado (minúsculas); en EF `HasConversion` → columna `email` |
| `User` | `User.cs` | Agregado; `ITenantEntity`, `IAuditable`, `ISoftDeletable`; `Phone?`, `JobTitle?`, `LastLoginAt?` (`TouchLastLogin`); `User.Create(...)` → `Result<User>` |
| `Role` | `Role.cs` | Agregado; tenant-scoped; `Description?`, `IsSystem` (rol de plataforma / no borrar en UI); soft-delete; `UserRoles`, `RolePermissions` |
| `Permission` | `Permission.cs` | Catálogo global; `DisplayName?`, `Module?`, `SortOrder`; `PermissionStatus`; `Code` en minúsculas; navegación `Policies` |
| `Policy` | `Policy.cs` | Condición ABAC opcional sobre un permiso; `PolicyEffect`; ver doc **12** |
| `PolicyEffect` | `PolicyEffect.cs` | `Allow`, `Deny` |
| `PermissionStatus` | `PermissionStatus.cs` | `Active`, `Deprecated` |
| `UserRole` | `UserRole.cs` | Unión usuario↔rol; `UserRole.Assign(...)` |
| `RolePermission` | `RolePermission.cs` | Unión rol↔permiso; `RolePermission.Link(...)` |

**`Tenant`** (`Tenancy/Tenant.cs`) tiene campos opcionales de **perfil UI** (`DisplayName`, `TimeZoneId`, `Locale`, `LogoUrl`, `PrimaryColorHex`) además del plan de servicio; navegaciones ORM `Users` y `Roles` (no son invariantes de negocio obligatorias para crear un tenant).

---

## 3. Multi-tenant: `ITenantContext` y middleware

| Pieza | Ubicación | Función |
|---|---|---|
| `ITenantContext` | `EcuNexo.Business/Abstractions/ITenantContext.cs` | `CurrentTenantId` + `SetCurrentTenant(Guid)` |
| Implementación | `EcuNexo.Data/ScopedTenantContext.cs` | Registrada como **scoped** en `AddData` |
| Middleware | `EcuNexo.Api/Middleware/TenantResolutionMiddleware.cs` | Si la ruta tiene `tenantId`, resuelve `Guid` y llama `SetCurrentTenant` |

Se registra en `Program.cs` con `app.UseMiddleware<TenantResolutionMiddleware>()` **antes** de los endpoints.

> ⚠️ Rutas **sin** `tenantId` (p. ej. `POST /api/v1/tenants` o `POST /api/v1/permissions`) dejan `CurrentTenantId` en **null**. Los filtros EF se comportan como “sin restricción por tenant” en ese caso (ver siguiente sección).

---

## 4. Filtros globales en `EcuNexoDbContext`

Archivo: `EcuNexo.Data/EcuNexoDbContext.cs`.

| Entidad | Filtro (idea) |
|---|---|
| `User` | Tenant actual (si hay) **y** `DeletedAt == null` |
| `Role` | Igual que `User` |
| `UserRole` | `TenantId` del contexto (si hay) |
| `Permission` | Solo `DeletedAt == null` (no hay tenant en la entidad) |
| `RolePermission` | `Role.TenantId == CurrentTenantId` (si hay tenant resuelto) |
| `Policy` | `Permission.DeletedAt == null` (políticas solo de permisos no borrados) |

**`Tenant`** no implementa `ITenantEntity` respecto al skill: es la raíz multi-tenant; **no** lleva este filtro.

---

## 5. Esquema PostgreSQL (`identity` + `tenancy`)

| Tabla | Esquema | Relaciones relevantes |
|---|---|---|
| `tenants` | `tenancy` | Docs 09–10; columnas de **perfil UI** (`display_name`, `time_zone_id`, `locale`, `logo_url`, `primary_color_hex`) para branding en la app |
| `users` | `identity` | FK `tenant_id` → `tenancy.tenants`; único `(tenant_id, email)` activos; columnas opcionales `phone`, `job_title`, `last_login_at` (`timestamptz`) |
| `roles` | `identity` | FK a `tenants`; único `(tenant_id, name)` activos; `description`, `is_system` (default `false`) |
| `user_roles` | `identity` | PK compuesta; FKs a tenant, user, role |
| `permissions` | `identity` | Sin `tenant_id`; único `code` con filtro soft-delete; `display_name`, `module`, `sort_order` (default `0`) |
| `role_permissions` | `identity` | PK `(role_id, permission_id)`; CASCADE al borrar **rol** |
| `policies` | `identity` | FK `permission_id` → `permissions` (CASCADE); ABAC sobre permiso global (ver doc **12**) |

Configuraciones EF: carpeta `EcuNexo.Data/Configurations/` (`UserConfiguration`, `RoleConfiguration`, `PolicyConfiguration`, etc.).

---

## 6. Migraciones relacionadas (orden)

Ejecutar siempre con `--project src/EcuNexo.Data --startup-project src/EcuNexo.Api`.

| Migración | Qué crea / ajusta |
|---|---|
| `InitialTenancy` | `tenancy.tenants` |
| `AddIdentityUsers` | `identity.users` |
| `RelateTenantUserNavigations` | Snapshot/modelo: navegaciones `User`↔`Tenant` (sin DDL si está vacía) |
| `AddIdentityRoles` | `identity.roles`, `identity.user_roles` |
| `AddIdentityPermissions` | `identity.permissions`, `identity.role_permissions` |
| `AddPolicy` | `identity.policies` |
| `AddSaaSUiAndDirectoryColumns` | Columnas UI/directorio en `tenancy.tenants`, `identity.users`, `identity.roles`, `identity.permissions` |

---

## 7. Capa Business (comandos y puertos)

**Puertos** (`EcuNexo.Business/Identity/`):

- `IUserRepository`, `IRoleRepository`, `IUserRoleRepository`, `IPermissionRepository`, `IRolePermissionRepository`, `IPolicyRepository` (ver doc **12**)

**Comandos** (cada uno con `*Command`, `*Handler`, `*Validator`, `*Response` salvo que sea trivial):

| Comando | Handler comprueba / hace |
|---|---|
| `CreateUserCommand` | Tenant existe; email único; `User.Create` |
| `CreateRoleCommand` | Tenant existe; nombre no duplicado (ignorando mayúsculas en app); `Role.Create` |
| `AssignUserRoleCommand` | Tenant, usuario y rol activos en ese tenant; union no duplicada |
| `CreatePermissionCommand` | Código no duplicado (activos); `Permission.Create` |
| `GrantRolePermissionCommand` | Tenant, rol, permiso activo; vínculo no duplicado; `RolePermission.Link` |
| `CreatePolicyCommand` | Permiso activo; `Policy.Create`; si hay condición, **`ValidateConditionSyntaxAsync`** (DynamicExpresso); persistencia vía `IPolicyRepository` (doc **12**) |

Registro DI: `EcuNexo.Business/DependencyInjection.cs` — `AddValidatorsFromAssemblyContaining` + **`ISender` / `Sender`**, `ICommandHandler<,>` e `IQueryHandler<,>` por par comando/consulta y respuesta.

---

## 8. Referencia de endpoints HTTP (v1)

Resumen rápido abajo; **catálogo detallado** (propósito, dependencias, cabeceras): **`10-api-host-y-endpoints.md`**.

Base: rutas versionadas con segmento `v1` (ver `Asp.Versioning` en `Program.cs`).

### 8.1 Tenancy (recordatorio)

| Método | Ruta | Cuerpo (JSON) |
|---|---|---|
| `POST` | `/api/v1/tenants` | `name`, `servicePlanName`, `maxUsers`, `maxWarehouses`, `displayName?`, `timeZoneId?`, `locale?`, `logoUrl?`, `primaryColorHex?` |

### 8.2 Identity — usuarios y roles

| Método | Ruta | Cuerpo |
|---|---|---|
| `POST` | `/api/v1/tenants/{tenantId}/users` | `email`, `name`, `department?`, `phone?`, `jobTitle?` |
| `POST` | `/api/v1/tenants/{tenantId}/roles` | `name`, `description?`, `isSystem?` |
| `POST` | `/api/v1/tenants/{tenantId}/users/{userId}/roles` | `roleId` |

### 8.3 Identity — permisos (global) y asignación a rol

| Método | Ruta | Cuerpo |
|---|---|---|
| `POST` | `/api/v1/permissions` | `code`, `description?`, `displayName?`, `module?`, `sortOrder?` |
| `POST` | `/api/v1/permissions/{permissionId}/policies` | `effect`, `condition?` — requiere permiso `identity.policies.manage` + cabeceras (doc **12**) |
| `POST` | `/api/v1/tenants/{tenantId}/roles/{roleId}/permissions` | `permissionId` |
| `GET` | `/api/v1/tenants/{tenantId}/authorization/verify?permission=` | Diagnóstico RBAC+ABAC (doc **12**) |

### 8.4 Lecturas GET (resumen)

Los listados y detalles exponen los campos anteriores en **camelCase** (p. ej. usuario: `phone`, `jobTitle`, `lastLoginAt`; rol: `description`, `isSystem`; permiso: `displayName`, `module`, `sortOrder`). Catálogo completo de rutas y payloads: **`10-api-host-y-endpoints.md`**.

**Respuestas POST**: éxito típico **201** con `Location`; errores vía `ResultHttpExtensions` → ProblemDetails (`Extensions/ResultHttpExtensions.cs`).

Archivos de rutas:

- `Endpoints/V1/Tenancy/TenantEndpoints.cs`
- `Endpoints/V1/Identity/UserEndpoints.cs`
- `Endpoints/V1/Identity/RoleEndpoints.cs` (incluye alta de rol, asignación usuario↔rol y **grant** rol↔permiso)
- `Endpoints/V1/Identity/PermissionEndpoints.cs` (alta de permiso global y **políticas** anidadas)
- `Endpoints/V1/Identity/AuthorizationEndpoints.cs` (**verify** autorización) `Contracts/V1/Identity/*.cs`, `Contracts/V1/Tenancy/*.cs`.

### 8.5 Seed en Development

Si `IHostEnvironment.IsDevelopment()` y la BD **no tiene ningún tenant**, al arrancar la Api (`Program.cs` → `DevelopmentCatalogSeeder.EnsureSeedAsync` después del seed de códigos de activación; ver **14**) se crea un tenant demo (**Everchic Demo**), permisos `identity.policies.manage` y `catalog.product.read`, rol **Administrador** (`isSystem: true`) con **todos los permisos activos** del catálogo global, y usuario **`superusuario.seed@ecunexo.local`**. Con tenants ya existentes el seed de catálogo **no ejecuta nada**. Detalle: doc **10** y **14**, código `Development/DevelopmentCatalogSeeder.cs`.

---

## 9. Secuencia de estudio práctica (ejercicio mental)

0. **Opcional (Development, BD vacía)** — arrancar la Api y usar el tenant/usuario del seed en lugar de crear todo a mano.
1. Crear **tenant** → anotar `tenantId`.
2. Crear **permiso** global (`POST /permissions`) → anotar `permissionId`.
3. Crear **rol** en ese tenant → `roleId`.
4. **`Grant`** permiso al rol (`POST .../roles/{roleId}/permissions`).
5. Crear **usuario** → `userId`.
6. **Asignar rol** al usuario (`POST .../users/{userId}/roles`).

Así recorres todo el grafo **User → UserRole → Role → RolePermission → Permission**. Opcionalmente, **Policy** sobre el permiso (doc **12**).

---

## 10. Qué aún no está (para no confundirte con el skill)

| Tema en `ecunexo-architecture` | Estado en código |
|---|---|
| `Role.IsGlobal` (operador SaaS) | **No** implementado; todos los roles son por tenant |
| `Policy` + ABAC (`IPolicyEvaluator`) | **Parcial**: HTTP **`IPermissionAccessGuard`**, cabeceras `X-EcuNexo-*`, JWT con claims cuando aplica, `GET .../authorization/verify`, filtro en crear política; mapeo claims→contexto en evolución (doc **12**) |
| `ISender` / `AskAsync` | **Sí**: façade scoped (`SendAsync` comandos, `AskAsync` consultas); los handlers se registran en DI (ver `DependencyInjection.cs`) |
| Autenticación JWT / `RequireAuthorization` | **JWT Bearer** validado en el host y `ICallerContext` desde claims o cabeceras (doc **10**); **no** hay `RequireAuthorization()` global: varias rutas siguen siendo públicas salvo filtros de permiso puntuales |
| OpenAPI + Scalar | Doc **10** — `/openapi/v1.json`, `/scalar/v1` |

Ver doc **12** para el estado actual de `Policy` y `IPolicyEvaluator`.

---

## 11. Archivos clave (mapa rápido)

```
src/EcuNexo.Core/Identity/          ← entidades + VO
src/EcuNexo.Business/Abstractions/  ← ITenantContext, CQRS, IUnitOfWork
src/EcuNexo.Business/Identity/      ← repositorios (puertos) + Commands/*Handlers
src/EcuNexo.Data/
├── EcuNexoDbContext.cs             ← filtros + DbSets
├── ScopedTenantContext.cs
├── Configurations/
├── Repositories/
└── Migrations/
src/EcuNexo.Api/
├── Program.cs
├── Development/DevelopmentCatalogSeeder.cs
├── Middleware/TenantResolutionMiddleware.cs
├── Endpoints/V1/Identity/
└── Contracts/V1/Identity/
```

> 📚 Skills: `ecunexo-architecture`, `ecunexo-data-model`, `ecunexo-coding-standards`.

---

*Bitácora alineada al código en la fecha de actualización del `docs/README.md`.*
