# 08 — Capa Business: CQRS ligero y comando `CreateTenant`

## Qué hicimos

### 1. Contratos CQRS (`EcuNexo.Business`)

Archivo `src/EcuNexo.Business/Abstractions/Cqrs.cs`:

- `ICommand<TResponse>` / `IQuery<TResponse>` — marcadores para comandos (escritura) y consultas (lectura).
- `ICommandHandler<TCommand, TResponse>` / `IQueryHandler<...>` — contrato `Handle(...)` que devuelve `Task<Result<TResponse>>` (tipo definido en Core).
- **`ISender`** — contrato en `Abstractions/ISender.cs`; implementación **`Sender`** resuelve el handler vía `IServiceProvider` en el scope de la petición y llama a `Handle`. Los endpoints Api inyectan **`ISender`** y llaman **`SendAsync<TCommand, TResponse>(...)`** (genéricos explícitos).

> 💡 EcuNexo **no usa MediatR**. **`AddBusiness`** registra handlers **y** `ISender` (ver `DependencyInjection.cs`).

### 2. Puertos de infraestructura (definidos en Business, implementados en Data)

| Archivo | Rol |
|---|---|
| `Abstractions/IUnitOfWork.cs` | `SaveChangesAsync(ct)` — frontera de persistencia. |
| `Tenancy/ITenantRepository.cs` | `AddAsync(Tenant, ct)` — alta del agregado `Tenant`. |

### 3. Primer caso de uso: crear tenant

Carpeta `src/EcuNexo.Business/Tenancy/Commands/`:

| Archivo | Rol |
|---|---|
| `CreateTenant.cs` | `CreateTenantCommand` → `ICommand<CreateTenantResponse>` (parámetros opcionales de **perfil UI**: `DisplayName`, `TimeZoneId`, `Locale`, `LogoUrl`, `PrimaryColorHex`). |
| `CreateTenantResponse.cs` | Respuesta (`TenantId`) + `FromTenant(Tenant)`. |
| `CreateTenantValidator.cs` | **FluentValidation** — reglas de entrada alineadas con `Tenant.MaxNameLength` y `ServicePlan.MaxNameLength` (no duplicar invariantes del agregado). |
| `CreateTenantHandler.cs` | Orquesta: validar → `ServicePlan` → `IIdGenerator` → `Tenant.Create` → `ITenantRepository` → `IUnitOfWork`. |

Paquetes en `EcuNexo.Business.csproj`: `FluentValidation`, `FluentValidation.DependencyInjectionExtensions`.

### 4. Registro DI (`DependencyInjection.cs`)

- `AddBusiness`: registra validators del ensamblado, cada `ICommandHandler<,>` y **`ISender` → `Sender`**.

> ⚠️ En Api habrá que llamar `AddBusiness()` **y** registrar implementaciones de `IIdGenerator`, `ITenantRepository`, `IUnitOfWork` (proyecto **Data**).

### Inventario de archivos (`src/EcuNexo.Business`)

```
Abstractions/Cqrs.cs
Abstractions/ISender.cs
Abstractions/IUnitOfWork.cs
DependencyInjection.cs
Sender.cs
Tenancy/ITenantRepository.cs
Tenancy/Commands/CreateTenant.cs              ← CreateTenantCommand
Tenancy/Commands/CreateTenantResponse.cs
Tenancy/Commands/CreateTenantValidator.cs
Tenancy/Commands/CreateTenantHandler.cs
```

### 5. Dependencia de Core

Asume `Tenant`, `ServicePlan`, `Result`, `Error`, `IIdGenerator`, etc. en **Core**.

## Por qué

- **Business** orquesta sin HTTP ni EF; solo **contratos** hacia Data.
- Validador = forma de la **entrada**; `Tenant.Create` sigue siendo la fuente de verdad del **modelo**.
- **`ConfigureAwait(false)`** en el handler es aceptable en librerías de aplicación que no dependen del contexto de sincronización de UI.

## Qué sigue (10+)

Implementar endpoints HTTP versionados y mapeo `Result` → ProblemDetails: ver **[`10-api-host-y-endpoints.md`](10-api-host-y-endpoints.md)**. Data y migración inicial: **[`09-capa-data-tenant-persistencia.md`](09-capa-data-tenant-persistencia.md)** (completado en repo).

> 📚 Skills: `ecunexo-coding-standards`, `ecunexo-data-model`.
