# 12 — Policy y fundamento ABAC sobre permisos globales

Este capítulo describe **lo que ya está en el código** para extender el RBAC (doc **11**) con **políticas** por permiso: efecto Allow/Deny y una **condición** textual opcional evaluada con **DynamicExpresso** (expresión C# que devuelve `bool`).

> 💡 **Idea clave**: en EcuNexo el **permiso** sigue siendo un catálogo global reutilizable entre tenants. Cada permiso puede tener **varias** `Policy` que acotan *cuándo* ese permiso concede o niega el acceso, más allá de la mera membresía en roles.

---

## 1. Qué problema resuelve

| Necesidad | Cómo se cubre hoy |
|---|---|
| Mismo código de permiso, reglas distintas según contexto | `Policy.Condition` (texto; vacío = solo RBAC) + `PolicyEffect` |
| Persistencia y API coherentes con el resto de Identity | Tabla `identity.policies`, comando `CreatePolicy`, endpoint anidado bajo el permiso |
| Motor de expresiones sin acoplar el dominio | `IPolicyEvaluator` en **Business**; implementación **`DynamicExpressoPolicyEvaluator`** |
| Rechazar condiciones ilegibles al dar de alta la política | `ValidateConditionSyntaxAsync` en el handler de **`CreatePolicy`** (tras `Policy.Create`, antes de guardar) |
| Autorización HTTP (RBAC + Deny ABAC) | **`IPermissionAccessGuard`**, JWT **o** cabeceras `X-EcuNexo-*`, filtro en **`POST .../policies`**, endpoint **`GET .../authorization/verify`** |

> **Identidad**: `ICallerContext` se rellena desde el **JWT** cuando la petición está autenticada (`sub` y claim **`tid`**; ver `JwtClaimTypes` en Api). Si no hay Bearer válido, se usan las cabeceras `X-EcuNexo-*`. El guard en **Business** no cambia.

---

## 2. Autorización HTTP (`IPermissionAccessGuard`)

Flujo al llamar **`RequireAsync(permissionCode, evaluationContext, ct)`**:

1. **Usuario**: `ICallerContext.UserId` — claim **`sub`** (JWT) o cabecera **`X-EcuNexo-User-Id`** — si falta → `401` (`auth.user_id.required`).
2. **Tenant**: `ITenantContext.CurrentTenantId` (ruta `tenantId` resuelta por middleware) **o** `ICallerContext.ExplicitTenantId` (claim **`tid`** en JWT o cabecera **`X-EcuNexo-Tenant-Id`**) — si falta → `400` (`auth.tenant.required`).
3. Usuario **activo** en el tenant (`IUserRepository`) — si no → `403` (`auth.user.not_found`).
4. **Permiso** por **código** normalizado (`IPermissionRepository.GetActiveIdByCodeAsync`) — si no existe → `404` (`permission.not_found`).
5. **RBAC**: ¿el usuario tiene ese permiso vía roles? (`IUserPermissionQuery`) — si no → `403` (`permission.rbac.denied`).
6. **ABAC**: para cada `Policy` del permiso (orden por `CreatedAt`, `Id`), se evalúa `Condition` con `IPolicyEvaluator`. Si la condición es **cierta** y el efecto es **Deny** → `403` (`policy.deny`). Efectos **Allow** que coinciden no bloquean en esta versión (solo refuerzan el modelo para evoluciones).

**Cabeceras** (Api, prefijo `X-EcuNexo-`; alternativa si **no** envías `Authorization: Bearer`):

| Cabecera | Uso |
|---|---|
| `X-EcuNexo-User-Id` | GUID del usuario (si no hay JWT con **`sub`**). |
| `X-EcuNexo-Tenant-Id` | Obligatoria en rutas **sin** `tenantId` (p. ej. `POST /permissions/.../policies`) si el guard necesita RBAC por tenant y el JWT no trae **`tid`**. |
| `X-EcuNexo-Resource-Id` | Opcional: recurso para `ctx.ResourceId` si la ruta no define `resourceId`. |

**Fábrica**: `PolicyEvaluationContextFactory.Create` en `Api/Security/` — rellena `ctx` para el evaluador.

**Filtro de endpoint**: `PermissionFilters.Require("código.permiso")` — usado en **`POST /api/v1/permissions/{permissionId}/policies`** con código **`identity.policies.manage`**.

**Bootstrap** recomendado para crear la primera política:

1. `POST /api/v1/permissions` con código `identity.policies.manage` (endpoint aún sin guard).
2. Rol, **grant** de ese permiso, usuario y asignación rol–usuario (flujo doc **11**).
3. `POST .../policies` con **Bearer** (recomendado) o con cabeceras `X-EcuNexo-User-Id` y `X-EcuNexo-Tenant-Id`.

**Verificación manual**: `GET /api/v1/tenants/{tenantId}/authorization/verify?permission=código` con el mismo Bearer o con las cabeceras de usuario.

---

## 3. Contexto ABAC (`PolicyEvaluationContext`)

Tipo: `EcuNexo.Business/Identity/PolicyEvaluation/PolicyEvaluationContext.cs` (record).

| Miembro | Uso en expresiones |
|---|---|
| `UserId`, `TenantId`, `ResourceId` | `Guid?` — comparar con `null`, `==`, `Guid.Parse("...")`, etc. |
| `UtcNow` | `DateTimeOffset` — reglas basadas en tiempo |
| `UserDepartment`, `UserJobTitle` | `string?` — atributos del usuario (cargados en `CreateAsync`) |
| `ResourceCreatedBy`, `ResourceDepartment` | `Guid?` / `string?` — atributos de recurso (evolución) |

**Evaluación UI**: `POST /api/v1/tenants/{tenantId}/authorization/evaluate` devuelve `allowedActions` (mapa estático MVP en `UiAccessEvaluator`).

En las expresiones almacenadas en `Policy.Condition`, el identificador fijo es **`ctx`** (instancia de `PolicyEvaluationContext`).

**Ejemplos** (ilustrativos; la sintaxis es la admitida por DynamicExpresso, similar a C#):

```text
ctx.TenantId != null
ctx.UserId != null && ctx.ResourceId != null
ctx.UtcNow.Hour >= 8 && ctx.UtcNow.Hour < 18
```

`ForSyntaxCheck()` devuelve un contexto mínimo solo para **parsear** al crear la política; no sustituye a un contexto real en autorización.

---

## 4. Entidades en `EcuNexo.Core` (`src/EcuNexo.Core/Identity/`)

| Tipo | Archivo | Notas |
|---|---|---|
| `PolicyEffect` | `PolicyEffect.cs` | `Allow`, `Deny` |
| `Policy` | `Policy.cs` | Hija conceptual del agregado `Permission`; `IAuditable`; `Condition` máx. 8000 caracteres en dominio; `Policy.Create` → `Result<Policy>` |
| `Permission` | `Permission.cs` | Navegación `Policies` (colección) |

`Policy` no implementa `ITenantEntity`: el aislamiento por tenant sigue llegando vía **usuario/rol**; las condiciones referencian atributos vía **`ctx`** cuando decidas qué rellenar en `PolicyEvaluationContext`.

---

## 5. Persistencia y filtros (`EcuNexo.Data`)

| Pieza | Ubicación | Detalle |
|---|---|---|
| Configuración EF | `Configurations/PolicyConfiguration.cs` | Esquema `identity`, tabla `policies`, FK `permission_id` → `permissions` con **CASCADE**, `condition` como `text`, `xmin`, índice en `permission_id` |
| Repositorio | `Repositories/PolicyRepository.cs` | Implementa `IPolicyRepository` |
| `DbContext` | `EcuNexoDbContext.cs` | `DbSet<Policy>`; filtro global: políticas solo si `Permission.DeletedAt == null` |

**Migración**: `AddPolicy` — crea `identity.policies`.

---

## 6. Capa Business

| Pieza | Rol |
|---|---|
| `IPolicyRepository` | Persistencia; **`ListByPermissionIdAsync`** para el guard |
| `IPermissionRepository` | **`GetActiveIdByCodeAsync`** (código ya normalizado) |
| `IUserPermissionQuery` | RBAC: usuario tiene permiso vía roles activos |
| `IPermissionAccessGuard` | Orquesta comprobaciones y políticas **Deny** |
| `IPolicyEvaluator` | `EvaluateAsync(condition, context, ct)` y `ValidateConditionSyntaxAsync(condition, ct)` |
| `DynamicExpressoPolicyEvaluator` | Motor **DynamicExpresso.Core**; variable `ctx`; errores de evaluación → `policy.evaluator.failed` (**Unexpected**) |
| `StubPolicyEvaluator` | Sigue en el repo para **sustituir** por DI en pruebas; rechaza evaluación y validación de sintaxis si dejas el stub |
| `CreatePolicyCommand` + handler | Tras crear el agregado en memoria, si `Condition` no es vacía, valida sintaxis; fallo → `policy.condition.syntax` (**Validation**) |

**Paquete NuGet** (versiones centralizadas en `Directory.Packages.props`): `DynamicExpresso.Core`.

Registro en `DependencyInjection.cs`: `IPolicyEvaluator` → `DynamicExpressoPolicyEvaluator`; **`IPermissionAccessGuard`** → `PermissionAccessGuard`.

> ⚠️ **Seguridad**: DynamicExpresso ejecuta expresiones C#. Las condiciones deben considerarse **entrada privilegiada** (solo administradores). Endurecer (listas blancas de tipos/métodos, límites de tiempo, etc.) es mejora futura si expusieras edición de condiciones a más actores.

---

## 7. API (v1)

| Método | Ruta | Notas |
|---|---|---|
| `POST` | `/api/v1/permissions/{permissionId}/policies` | Cuerpo: `effect`, `condition?`. **Guard**: `identity.policies.manage` + cabeceras `X-EcuNexo-User-Id` y `X-EcuNexo-Tenant-Id`. |
| `GET` | `/api/v1/tenants/{tenantId}/authorization/verify?permission=` | Comprueba el flujo completo; cabecera de usuario recomendada. |

Si `condition` tiene texto y no es una expresión `bool` válida, el handler responde `policy.condition.syntax` (**Validation**). Los demás errores siguen el guard (sección 2).

Rutas: `PermissionEndpoints.cs`, `AuthorizationEndpoints.cs`. DTO: `CreatePolicyRequest.cs`.

---

## 8. Pendientes naturales

1. Sustituir cabeceras por **JWT** y claims (`sub`, `tid`, etc.) manteniendo `ICallerContext`.
2. Extender **`PermissionFilters.Require`** al resto de endpoints sensibles.
3. Enriquecer **contexto** ABAC (departamento, bodega, etc.).
4. Semántica **Allow** “de puerta obligada” si el producto la necesita.
5. CRUD adicional sobre políticas (listar, editar, borrar).
6. Endurecer el **sandbox** del evaluador DynamicExpresso si la superficie de edición crece.

---

## 9. Archivos clave

```
src/EcuNexo.Core/Identity/Policy.cs, PolicyEffect.cs
src/EcuNexo.Business/Abstractions/ICallerContext.cs
src/EcuNexo.Business/Identity/IPolicyRepository.cs, IPermissionRepository.cs, IPolicyEvaluator.cs
src/EcuNexo.Business/Identity/IUserPermissionQuery.cs
src/EcuNexo.Business/Identity/Authorization/IPermissionAccessGuard.cs, PermissionAccessGuard.cs
src/EcuNexo.Business/Identity/PolicyEvaluation/*.cs
src/EcuNexo.Business/Identity/Commands/CreatePolicy*.cs
src/EcuNexo.Data/Repositories/PolicyRepository.cs, UserPermissionQuery.cs, PermissionRepository.cs
src/EcuNexo.Api/Security/HttpCallerContext.cs, PolicyEvaluationContextFactory.cs, PermissionFilters.cs
src/EcuNexo.Api/Endpoints/V1/Identity/AuthorizationEndpoints.cs, PermissionEndpoints.cs
src/EcuNexo.Api/Extensions/ResultHttpExtensions.cs
Directory.Packages.props   ← DynamicExpresso.Core
```

> 📚 Skills: `ecunexo-architecture`, `ecunexo-data-model`, `ecunexo-coding-standards`.

---

*Bitácora alineada al código en la fecha de actualización del `docs/README.md`.*
