# 09 — Capa Data: persistir `Tenant`

## Estado en el repositorio

> **2026-05-12**: implementados **DbContext**, configuración EF, repositorio, UoW, generador UUID v7, **migración inicial** y host **Api** mínimo con `Program.cs` para DI y herramientas EF. Actualizar **README** (tabla Progreso) si cambia el alcance.

## Qué hicimos

### Ajuste en Core

- **`ServicePlan`**: constructor privado sin parámetros para que EF Core pueda **materializar** el tipo al leer desde la base (uso del ORM; en aplicación se sigue creando con `new ServicePlan(...)`).

### Paquetes (CPM)

En `Directory.Packages.props`, versiones **EF Core 10.0.7** alineadas con **Npgsql 10.0.1** (este último exige `Microsoft.EntityFrameworkCore` / `Relational` **≥ 10.0.4**).

### `EcuNexo.Data`

| Elemento | Descripción |
|---|---|
| `EcuNexoDbContext` | `DbSet<Tenant>` + `ApplyConfigurationsFromAssembly`. |
| `Configurations/TenantConfiguration.cs` | Tabla `tenancy.tenants`, PK `uuid`, `ServicePlan` como **`ComplexProperty`** (columnas `plan_*`), auditoría `timestamptz`, **concurrencia** vía columna sombra `xmin` (`xid`). |
| `UuidV7Generator` | `internal`, implementa `IIdGenerator`. |
| `Repositories/TenantRepository` | `AddAsync` sobre el `DbContext`. |
| `EfUnitOfWork` | `SaveChangesAsync` delegado en el mismo contexto (registro **scoped**). |
| `DependencyInjection.AddData(string connectionString)` | `UseNpgsql`, `UseSnakeCaseNamingConvention`, historial de migraciones en `tenancy.__ef_migrations_history`, registra `IIdGenerator`, `ITenantRepository`, `IUnitOfWork`. |
| `Migrations/` | `InitialTenancy` (sufijo de timestamp según `dotnet ef`) — esquema `tenancy` y tabla `tenants`. |

### `EcuNexo.Api`

- SDK **Web**, `Microsoft.EntityFrameworkCore.Design` (PrivateAssets) para `dotnet ef`.
- `Program.cs`: `AddBusiness()` + `AddData(connectionString)`.
- `appsettings.json`: cadena **`ConnectionStrings:Default`** de ejemplo (ajustar usuario/clave en tu PostgreSQL).

## Comandos útiles

```bash
# Crear migración (desde la raíz del repo; rutas según tu máquina)
dotnet ef migrations add NombreMigracion --project src/EcuNexo.Data --startup-project src/EcuNexo.Api --output-dir Migrations

# Aplicar a la base local
dotnet ef database update --project src/EcuNexo.Data --startup-project src/EcuNexo.Api
```

## Notas pedagógicas

> 💡 Se mapeó `ServicePlan` con **`ComplexProperty`** (valor complejo) en lugar de **`OwnsOne`**, porque el *owned* generaba una entidad dependiente con FK sombra mal alineada a la PK `id`.

> ⚠️ **Tenant** no implementa `ITenantEntity`.

> 📚 **Organización en PostgreSQL** (qué tablas van en `tenancy` vs `identity`, historial de migraciones): doc **13**.

## Qué sigue (evolución Data)

- **Hecho en repo**: host Api versionado, **`ISender`**, repositorios Identity, migraciones hasta **`AddSaaSUiAndDirectoryColumns`** (columnas UI/directorio). Ver **10–13**.
- **Pendiente típico**: interceptores (`Tenant`, auditoría, domain events) según `ecunexo-data-model`; nuevos esquemas (`catalog`, etc.) cuando existan esos bounded contexts.
