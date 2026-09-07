# EcuNexo — Bitácora de aprendizaje

Documentación paso a paso del armado de **EcuNexo**: para qué sirve cada archivo creado, qué patrón aplica, qué concepto se está practicando y dónde profundizar.

> **Audiencia**: el dueño del proyecto (tú) en proceso de aprender Clean Architecture, DDD y .NET 10 a fondo. Cada documento responde tres preguntas: **qué hicimos / por qué / qué estudiar**.

## Cómo está organizada

| # | Archivo | Tema | Skill relacionado |
|---|---|---|---|
| 00 | [`00-introduccion.md`](00-introduccion.md) | Visión general, ADRs, **alta de clientes con código de activación** (enlace a **14**) | `ecunexo-architecture` |
| 01 | [`01-solucion-y-proyectos.md`](01-solucion-y-proyectos.md) | `dotnet new sln`, 4 proyectos, referencias entre ellos | `ecunexo-architecture` |
| 02 | [`02-directory-build-props.md`](02-directory-build-props.md) | `Directory.Build.props` — herencia MSBuild | `ecunexo-coding-standards` |
| 03 | [`03-central-package-management.md`](03-central-package-management.md) | `Directory.Packages.props` — versiones centralizadas | `ecunexo-coding-standards` |
| 04 | [`04-global-editorconfig-gitignore.md`](04-global-editorconfig-gitignore.md) | `global.json`, `.editorconfig`, `.gitignore` | `ecunexo-coding-standards` |
| 05 | [`05-estructura-carpetas.md`](05-estructura-carpetas.md) | Estructura por bounded context | `ecunexo-architecture` |
| 06 | [`06-result-pattern.md`](06-result-pattern.md) | `Result<T>`, `Error`, supresión de CA1716/CA1000 | `ecunexo-coding-standards` |
| 07 | [`07-conceptos-dominio-y-capas.md`](07-conceptos-dominio-y-capas.md) | Dominio vs HTTP, Core vs capas, DDD, `Common/`, ciclo hasta la tabla | `ecunexo-architecture` |
| 08 | [`08-capa-business-cqrs-create-tenant.md`](08-capa-business-cqrs-create-tenant.md) | CQRS, validator, handler, puertos, `AddBusiness`, **`ISender`** | `ecunexo-coding-standards` |
| 09 | [`09-capa-data-tenant-persistencia.md`](09-capa-data-tenant-persistencia.md) | Data: DbContext, EF `Tenant`, repos, migración, Api host mínimo | `ecunexo-data-model` |
| 10 | [`10-api-host-y-endpoints.md`](10-api-host-y-endpoints.md) | **`ISender`**, JWT, OpenAPI, Scalar, catálogo de endpoints, seeds Development, **onboarding / código de activación**, campos UI (tenant / identity) | `ecunexo-architecture` |
| 11 | [`11-identity-multitenant-rbac.md`](11-identity-multitenant-rbac.md) | Identity: User, Role, Permission, joins, filtros EF, middleware, rutas API | `ecunexo-architecture`, `ecunexo-data-model` |
| 12 | [`12-policy-abac-fundamentos.md`](12-policy-abac-fundamentos.md) | `Policy` + **DynamicExpresso**, **`IPermissionAccessGuard`**, cabeceras, filtro en crear política | `ecunexo-architecture`, `ecunexo-data-model` |
| 13 | [`13-postgresql-esquemas-tenancy-identity.md`](13-postgresql-esquemas-tenancy-identity.md) | PostgreSQL: esquemas `tenancy` / `identity`, tablas, migrations history, columnas UI, vs multi-tenant | `ecunexo-data-model`, `ecunexo-architecture` |
| 14 | [`14-onboarding-y-codigos-activacion.md`](14-onboarding-y-codigos-activacion.md) | **Canje de licencia** (`activate-license`), titular de suscripción, empresas (`/subscription/*`), legacy `tenant-with-activation` | `ecunexo-architecture`, `ecunexo-data-model`, `ecunexo-licensing-security` |
| 15 | [`15-catalogo-vs-inventario-y-planes.md`](15-catalogo-vs-inventario-y-planes.md) | **Catálogo maestro vs Inventario transaccional**, plan `services-starter`, RBAC+ABAC por módulo | `ecunexo-architecture`, `ecunexo-data-model` |
| 16 | [`16-api-versionamiento.md`](16-api-versionamiento.md) | **Versionado HTTP** (`/api/v1`), Asp.Versioning, carpetas `Endpoints/V1`–`V2`, OpenAPI/Scalar, cómo abrir v2 | `ecunexo-architecture`, `ecunexo-coding-standards` |

## Plataforma de licencias (Obsidian)

Carpeta dedicada al **administrador de licencias Ecunexo**, planes Ecuador, API/UI platform y flujos on-prem / cloud / híbrido. Formato wiki para respaldo en Obsidian.

| Recurso | Descripción |
|---|---|
| [`platform-licensing/README.md`](platform-licensing/README.md) | Índice comercial, licencias y flujo titular → empresas |
| [`platform-licensing/09-seguridad-licencias-desacopladas.md`](platform-licensing/09-seguridad-licencias-desacopladas.md) | Seguridad: doble hash, firma RSA, artefacto `.ecunexo-license` |
| [`platform-licensing/10-modelo-titular-suscripcion-rbac.md`](platform-licensing/10-modelo-titular-suscripcion-rbac.md) | **Modelo de negocio actual** (titular, multiempresa, RBAC tenant) |
| [`platform-licensing/11-formato-archivo-licencia.md`](platform-licensing/11-formato-archivo-licencia.md) | Formato del archivo `.ecunexo-license` (código + upload) |
| [`platform-licensing/12-module-entitlements.md`](platform-licensing/12-module-entitlements.md) | **Tiers, límites transaccionales y dependencias entre módulos** |
| [`platform-licensing/13-compliance-reissue.md`](platform-licensing/13-compliance-reissue.md) | **Validación online/offline de licencias y reemisión** |
| [`adr/008-platform-licensing-admin.md`](adr/008-platform-licensing-admin.md) | ADR: decisión de arquitectura |

> **Estado:** emisión platform (`IssueLicense`, `ReissueLicense`) y canje tenant (`ActivateLicense`, `subscription_accounts`, `/subscription/*`) **implementados**. `ModuleEntitlement` + tiers + `ModuleDependencyGraph`, `LicenseComplianceService` + validación online, y reemisión completos. UI operadores (`ecunexo_license`) y SPA admin tenant (`ecunexo_admin`) en monorepo.

## Handoff: frontend admin tenant

La **API v1** la consume el SPA **`ecunexo_admin/`** (React + Vite) en el monorepo.

| Tema | Dónde mirar |
|---|---|
| **Base URL local** | `http://localhost:5088` (perfil `http` en `src/EcuNexo.Api/Properties/launchSettings.json`). Prefijo API: **`/api/v1/...`**. |
| **Versionamiento** | URL segment `v1` — reglas, carpetas y cómo abrir **v2**: doc **[`16`](16-api-versionamiento.md)**. |
| **Contrato OpenAPI** | `GET /openapi/v1.json` — generar cliente TypeScript (`openapi-typescript`, Orval, NSwag, etc.) o proxy manual. |
| **Explorador** | `GET /scalar/v1` con la Api en marcha. |
| **Serialización JSON** | Propiedades en **camelCase** (ASP.NET Core por defecto). |
| **Auth productivo** | `POST /api/v1/auth/login` (email + password; resuelve titular o usuario tenant). |
| **Onboarding comercial** | `POST /api/v1/onboarding/activate-license` → JWT titular; luego `GET /api/v1/subscription/session`. Detalle: **14** y **`platform-licensing/10`**. |
| **Auth en Development** | `POST /api/v1/auth/dev-token` (cuerpo `userId`, `tenantId?`); enviar `Authorization: Bearer …`. Seed demo: **`superusuario.seed@ecunexo.local`**. |
| **Branding / tabla de configuración** | Respuestas de tenant y listados de usuarios, roles y permisos incluyen los campos documentados en **10** y **11**; vista física en **13**. |

> Actualizado: **2026-06-13**. Backend cubre **Tenancy + Identity + Policy + Suscripción (titular/empresas)**; **Catalog / Warehousing / Inventory** siguen sin API de dominio — arquitectura objetivo en **15** y ADR **009**.

## Progreso (sincronizado con el código)

| Proyecto / carpeta `src/` | Estado respecto a esta bitácora |
|---|---|
| `EcuNexo.Core` | Dominio: **Tenancy** (`Tenant`, **`SubscriptionAccount`**, **`ModuleEntitlement`**, **`ModuleDependencyGraph`**, **`ModuleTierCatalog`**, **`LicenseValidationPolicy`**, hasher de códigos) + **Identity** (**11–12**). |
| `EcuNexo.Business` | CQRS: **`ActivateLicense`**, **`ProvisionSubscriptionCompany`**, **`SwitchToCompanySession`**; **`GetSubscriptionSession`**; **`LicenseComplianceService`** (offline-first); `ListSubscriptionCompanies`, `OnboardTenantWithActivation` (legacy). |
| `EcuNexo.Data` | Esquemas **`tenancy`** / **`identity`** / **`platform`**; tablas **`subscription_accounts`** (`module_entitlements` jsonb, `license_expires_at_utc`, `online_validation_interval_days`), **`license_redemptions`** (`id` PK = grantId), menú. |
| `EcuNexo.Api` | JWT titular/tenant, **`/subscription/*`**, onboarding **`activate-license`**, **`LicenseOnlineValidator`**, OpenAPI + Scalar, seeds. |

> Flujos cerrados para UI: crear/consultar **tenant** con branding, **usuarios** (contacto / último login), **roles** (descripción, sistema), **permisos** (módulo, orden, etiqueta); RBAC+ABAC como en **11** y **12**. Catálogo de columnas: **13**.

## Convenciones de la doc

- **Bloques `> 💡`** son insights que vale la pena memorizar.
- **Bloques `> ⚠️`** son trampas comunes o reglas que no debes romper.
- **Bloques `> 📚`** son enlaces a profundizar.
- Los nombres de archivos y rutas se escriben en `código`.

## Glosario rápido (los términos que más se repiten)

| Término | Significado en el proyecto |
|---|---|
| **Bounded Context** | Frontera lingüística del dominio. En EcuNexo: Tenancy, Identity, Catalog, Warehousing, Inventory. |
| **Aggregate (agregado)** | Grupo de entidades que cambian juntas y comparten reglas. Una raíz controla el grupo. |
| **Value Object (VO)** | Dato sin identidad propia (ej. `Money`, `Address`). Inmutable. |
| **Domain Event** | Algo que ocurrió en el dominio (`StockDecreasedEvent`). |
| **Repository** | Abstracción de persistencia, una por agregado. |
| **CQRS** | Command Query Responsibility Segregation. Comandos cambian estado; queries leen. |
| **Result Pattern** | Devolver `Result<T>` en vez de lanzar excepciones para flujo esperado. |
| **Multi-tenant** | Una sola app sirve a muchos clientes (tenants) con datos aislados. |
| **TenantId** | Columna que identifica al cliente dueño de cada fila. |
| **Dominio (DDD)** | Negocio modelado en código; en CA el núcleo vive en **Core**. No confundir con dominio DNS/URL. Ver `07-conceptos-dominio-y-capas.md`. |

## Cómo se relaciona con los `skills`

Los archivos en `.cursor/skills/` son la **especificación normativa**: dicen QUÉ y POR QUÉ hacerlo así. Esta carpeta `docs/` es la **bitácora pedagógica**: explica CÓMO se materializó paso a paso, con notas de aprendizaje. Cuando algo cambie:

1. Primero se actualiza el skill (la regla).
2. Luego se documenta el porqué del cambio en un nuevo archivo `NN-…md`.

> ⚠️ Cuando haya duda entre lo que dice un skill y lo que dice esta doc, **el skill manda**.
