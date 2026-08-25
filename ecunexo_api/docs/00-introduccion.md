# 00 — Introducción a EcuNexo

## Qué es

**EcuNexo** es un ecosistema **SaaS Multi-tenant** para administración de inventarios, bodegas y tiendas en línea.

- **SaaS** (Software as a Service): el software corre en la nube y los clientes pagan por usarlo.
- **Multi-tenant**: una sola instalación de la aplicación sirve a múltiples clientes (cada cliente = un *tenant*), con sus datos aislados entre sí.

> 💡 Piensa en Slack: una sola app, miles de empresas dentro, cada una ve solo sus mensajes. Eso es multi-tenant.

## Stack tecnológico (sin negociación)

| Capa | Tecnología |
|---|---|
| Runtime | **.NET 10** (LTS) |
| Lenguaje | **C# 14** |
| API | **ASP.NET Core Minimal APIs** |
| Base de datos | **PostgreSQL 16+** |
| ORM | **Entity Framework Core 10** + **Npgsql** |
| Validación | **FluentValidation** |

> 📚 Si vienes de .NET Framework / .NET 4.x, el cambio mayor es: ya no hay `web.config`, todo es código (`Program.cs`); todo es DI nativa; todo es async. Empieza por la doc de [ASP.NET Core](https://learn.microsoft.com/aspnet/core).

## Arquitectura

Aplicamos **Clean Architecture + Domain-Driven Design (DDD)**. Cuatro proyectos con dependencias unidireccionales:

```
Api ──► Business ──► Core
 │                     ▲
 └─────► Data ─────────┘
```

| Proyecto | Capa | Responsabilidad | Reglas |
|---|---|---|---|
| `EcuNexo.Core` | Domain | Reglas de negocio puras, entidades, VOs | **Cero deps externas** |
| `EcuNexo.Business` | Application | Casos de uso (CQRS), validación | Depende solo de Core |
| `EcuNexo.Data` | Infrastructure | EF Core, repositorios, migraciones | Depende de Core + Business |
| `EcuNexo.Api` | Presentation | Endpoints HTTP, DI, configuración | Composition root |

> 💡 La regla clave de Clean Architecture: **las flechas apuntan al dominio**. Nada que esté "más cerca del usuario" puede ser referenciado desde más adentro.

## Decisiones arquitectónicas (ADRs cerrados)

Estas decisiones ya están **tomadas y blindadas en los skills**. No vamos a cambiarlas mientras avanzamos:

| # | Decisión | Por qué |
|---|---|---|
| ADR-001 | Multi-tenant **Shared DB + Discriminator** (columna `TenantId` + Global Query Filters de EF) | Más simple, menor costo. Suficiente hasta cientos de tenants. |
| ADR-002 | IDs **UUID v7** en todas las entidades | Ordenable temporalmente; óptimo para índices B-Tree de PostgreSQL. Evita exposer secuencias en URLs públicas. |
| ADR-003 | Autorización **RBAC + ABAC** (roles + políticas con condiciones) | El modelo del PDF ya incluye `Policy.condicion_abac` |
| ADR-004 | API: **Minimal APIs** (no Controllers MVC) | Menos ceremonia, mejor performance, perfecto para microservicios. |
| ADR-005 | Mensajería entre contextos: **Domain Events in-process** primero | YAGNI — bus externo solo cuando se justifique. |
| ADR-009 | **Catálogo maestro** vs **Inventario transaccional**; plan `services-starter` | [`adr/009-catalog-inventory-separation.md`](adr/009-catalog-inventory-separation.md) · doc **15** |
| ADR-010 | Kárdex append-only, documentos con estados, traspasos vía **bodega en tránsito**, variantes diferidas | [`adr/010-inventory-kardex-documents-transit.md`](adr/010-inventory-kardex-documents-transit.md) |

> 📚 Para entender ADRs: [adr.github.io](https://adr.github.io/). Es solo un markdown que documenta una decisión técnica importante con contexto, alternativas evaluadas y consecuencias.

## Bounded Contexts

Cinco contextos delimitados (DDD). Cada uno tiene su propia carpeta dentro de cada proyecto.

| Contexto | Agregado raíz | Para qué |
|---|---|---|
| **Tenancy** | `Tenant`, `ActivationCode` | Organizaciones cliente (**tenant**), planes y **códigos de activación** (licencia, cupos, módulos). |
| **Identity** | `User`, `Role` | Login, RBAC + ABAC |
| **Catalog** | `CatalogItem` | Maestro físico/servicio; jsonb + moldes (ADR-009/010) |
| **Warehousing** | `Warehouse` | Bodegas (incl. tránsito de sistema) |
| **Inventory** | `Stock`, `InventoryMovement` | Existencias y kárdex append-only |

> 💡 Un bounded context es una **frontera de lenguaje**. Dentro de él, "Producto" significa una cosa. En otro contexto (ej. ventas), "Producto" podría tener atributos distintos. La frontera evita acoplamiento.

---

## Alta de clientes: código de activación (visión de producto)

El flujo previsto para que un **nuevo cliente** entre al sistema sin intervención manual de GUIDs es: **introduce un código de activación** (emitido por comercial o por vosotros en on-prem) junto con los datos de su **primera empresa** y el **primer usuario administrador**. Ese código define en servidor **cuántas empresas puede crear**, **límites de plan** (usuarios, bodegas) y **qué módulos de producto** tiene habilitados (inventario, facturación, etc.); el valor del código **no se guarda en claro** en base de datos, solo una huella criptográfica con un **pepper** de configuración.

Todo el detalle operativo (endpoint HTTP, tablas PostgreSQL, seed en Development, emisión en producción y diferencias con `POST /tenants`) está en **[`14-onboarding-y-codigos-activacion.md`](14-onboarding-y-codigos-activacion.md)**.

---

## Idioma

| Qué | Idioma |
|---|---|
| Código (clases, métodos, variables) | **Inglés** |
| Mensajes al usuario final, errores en `Result` | **Español** |
| Documentación (esta carpeta `docs/`, skills) | **Español** |
| Comentarios en código | **Inglés** |

## Qué viene después

- **00 → 14**: ciclo **Api → Business → Data → BD** documentado; **10** es la referencia HTTP (OpenAPI, Scalar, seeds, JWT en Development); **14** describe **onboarding con código de activación** y entitlements del tenant.
- **Progreso vs código** y **handoff frontend**: tabla y sección dedicada en [`README.md`](README.md).
- **Cliente web**: SPA **`ecunexo_admin/`** consume **`/api/v1`**; bienvenida con **`POST .../onboarding/activate-license`**; titular gestiona empresas vía **`/subscription/*`**. Detalle: doc **14** y **`platform-licensing/10`**.
