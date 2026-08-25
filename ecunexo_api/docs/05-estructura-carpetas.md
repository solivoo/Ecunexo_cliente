# 05 — Estructura de carpetas por bounded context

## Qué hicimos

Creamos esta estructura debajo de cada proyecto:

```
src/EcuNexo.Core/
├── Common/         ← clases base (Entity, AggregateRoot, Result, Error)
├── Abstractions/   ← contratos (ITenantEntity, IAuditable, ISoftDeletable)
├── Tenancy/        ← bounded context: clientes SaaS
├── Identity/       ← bounded context: usuarios, roles, permisos
├── Catalog/        ← bounded context: productos, categorías
├── Warehousing/    ← bounded context: bodegas
└── Inventory/      ← bounded context: stock, movimientos

src/EcuNexo.Business/
├── Abstractions/   ← contratos de aplicación (ICommand, IQuery, ITenantContext)
├── Behaviors/      ← pipelines (Validation, Logging, Transaction)
├── Tenancy/
├── Identity/
├── Catalog/
├── Warehousing/
└── Inventory/

src/EcuNexo.Data/
├── Configurations/ ← IEntityTypeConfiguration por entidad
├── Interceptors/   ← TenantInterceptor, AuditInterceptor, DomainEventInterceptor
├── Multitenancy/   ← TenantContextAccessor, ITenantProvider
├── Migrations/     ← migraciones EF Core
└── Repositories/

src/EcuNexo.Api/
├── Endpoints/V1/   ← Minimal APIs versión 1
├── Endpoints/V2/   ← Minimal APIs versión 2 (cuando exista)
├── Contracts/V1/   ← DTOs Request/Response
├── Middleware/     ← TenantResolutionMiddleware, ExceptionHandler
└── Versioning/

tests/
├── EcuNexo.Core.UnitTests/
├── EcuNexo.Business.UnitTests/
└── EcuNexo.Api.IntegrationTests/
```

Cada carpeta contiene un `.gitkeep` (archivo vacío) para que Git la trackee aunque esté vacía. Los iremos eliminando conforme cada carpeta reciba su primer archivo real.

## Por qué

### Organizar por **bounded context**, no por capa técnica

❌ Mala organización (por tipo técnico):

```
Core/
├── Entities/
│   ├── Product.cs
│   ├── Warehouse.cs
│   └── Stock.cs
├── ValueObjects/
└── Repositories/
```

Problemas:
- "¿Dónde está la lógica de Product?" → revuelves 3 carpetas.
- Cuando el equipo crece, todos editan los mismos directorios → conflictos.
- No expresa el dominio. Para entender qué hace la app tienes que leer código.

✅ Buena organización (por bounded context, "package by feature"):

```
Core/
├── Catalog/
│   ├── Product.cs
│   ├── ProductVariant.cs
│   ├── Category.cs
│   └── Sku.cs
├── Inventory/
│   ├── Stock.cs
│   └── InventoryMovement.cs
└── Warehousing/
    └── Warehouse.cs
```

Beneficios:
- "¿Dónde está la lógica de Catalog?" → una carpeta, todo junto.
- Equipos pueden ser dueños de un contexto cada uno.
- Lees los nombres de carpetas y **ya entiendes** qué hace la app: "vende productos, gestiona bodegas e inventario, autentica usuarios". A esto se le llama **Screaming Architecture**.

> 💡 Un buen árbol de carpetas debería **gritarte el dominio**, no el framework. Si abres un repo y lo primero que ves es `Controllers/`, `Services/`, `DTOs/`, ese repo no te dice qué hace el negocio.

### Por qué los mismos contextos en cada proyecto

Porque cada bounded context tiene **artefactos en cada capa**:

| Contexto | En `Core` | En `Business` | En `Data` | En `Api` |
|---|---|---|---|---|
| Catalog | `Product`, `Sku` | `CreateProductCommand`, validators | `ProductConfiguration`, `ProductRepository` | `ProductEndpoints`, `ProductRequest` |

Mantener el mismo nombre de carpeta en las 4 capas hace que sea **trivial saltar** entre ellas. Si quieres ver "todo lo relacionado con productos", buscas `Catalog/` y listo.

### Carpetas transversales (`Common`, `Abstractions`, etc.)

Estas no representan un bounded context, sino infraestructura interna del proyecto:

| Carpeta | Qué va |
|---|---|
| `Core/Common/` | `Entity<TId>`, `AggregateRoot<TId>`, `Result`, `Error` — usado por todos los contextos. |
| `Core/Abstractions/` | Interfaces marker (`ITenantEntity`, `IAuditable`). |
| `Business/Abstractions/` | `ICommand<T>`, `IQuery<T>`, `ICommandHandler<,>`, `ITenantContext`. |
| `Business/Behaviors/` | Pipelines de validación, logging, transacciones (decoradores). |
| `Data/Configurations/` | `IEntityTypeConfiguration<T>` para EF Core (por agregado). |
| `Data/Interceptors/` | Interceptores de `SaveChangesAsync`. |
| `Api/Middleware/` | Middlewares ASP.NET (autenticación, tenant resolution, errores). |

## Estructura interna de un caso de uso (preview)

Cuando lleguemos a Business, dentro de cada bounded context aplicaremos **package by feature**:

```
Business/Catalog/
└── Products/
    └── Commands/
        └── CreateProduct/
            ├── CreateProductCommand.cs
            ├── CreateProductHandler.cs
            ├── CreateProductValidator.cs
            └── CreateProductResponse.cs
```

Una carpeta por caso de uso. **Todo lo del caso de uso vive junto.** Borrar el feature = borrar la carpeta.

## Conceptos aplicados

| Concepto | Para qué |
|---|---|
| **Bounded Context (DDD)** | Frontera lingüística del dominio. |
| **Screaming Architecture** | El árbol grita el dominio, no el framework. |
| **Package by Feature** vs **Package by Layer** | Organizar por intención, no por tipo técnico. |

## Aplicación web (frontend)

El backend vive bajo **`src/`** en los cuatro proyectos .NET. La **interfaz de usuario** no está acoplada a esa carpeta: lo habitual es añadir en la **raíz del repositorio** un directorio hermano, por ejemplo `web/`, `clients/web/` o `apps/web/`, con su propio `package.json` (React, Vue, etc.), consumiendo solo la API HTTP documentada en **`docs/10-api-host-y-endpoints.md`** y el OpenAPI en tiempo de desarrollo.

## Qué estudiar

- **Eric Evans — DDD libro azul**, capítulo 14 (Bounded Context).
- **Vaughn Vernon — Implementing DDD**, capítulo 2.
- **Robert C. Martin — Screaming Architecture**: [Clean Coder Blog](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html).

## Trampas comunes

- ⚠️ Resistir la tentación de crear `Shared/` para "cosas que usan varios contextos". Si dos contextos comparten lógica de dominio, normalmente significa que **debería haber un tercer contexto** o que el modelo está mal cortado. Lo único válido en `Common` es infraestructura del propio proyecto (clases base, primitivas).
- ⚠️ Las carpetas vacías con solo `.gitkeep` son normales mientras armamos la estructura. Cuando agregues el primer archivo real, **borra el `.gitkeep`** de esa carpeta.
