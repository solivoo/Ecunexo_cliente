# Tasks Checklist: `001-tenant-developer-api`

- **Spec**: `specs/001-tenant-developer-api/spec.md`
- **Plan**: `specs/001-tenant-developer-api/plan.md`

---

## Fase 1: Dominio y Persistencia (`EcuNexo.Core` & `EcuNexo.Data`)
- [x] **T1.1**: Crear entidad `TenantApiKey` e interfaz `ITenantApiKeyRepository` en `EcuNexo.Core/Identity/` y `EcuNexo.Business/Identity/`.
- [x] **T1.2**: Crear configuración EF Core `TenantApiKeyConfiguration`, registrar `DbSet<TenantApiKey>` en `EcuNexoDbContext` e implementar `TenantApiKeyRepository` en `EcuNexo.Data`.
- [x] **T1.3**: Generar y verificar migración EF Core `AddTenantApiKeys`.

## Fase 2: Negocio y Autorización Unificada (`EcuNexo.Business`)
- [x] **T2.1**: Definir `DeveloperApiScopes` con los permisos permitidos para consumo externo y sus descripciones legibles.
- [x] **T2.2**: Extender `ICallerContext` con soporte para identidad de API Key (`ApiKeyId`, `ApiKeyScopes`, `IsApiKeyCaller`) y actualizar `PermissionAccessGuard` para validar alcance multi-tenant, módulos contratados (`ModuleEntitlements`) y scopes de la llave.
- [x] **T2.3**: Implementar `CreateTenantApiKeyCommand`, `ListTenantApiKeysQuery`, `RevokeTenantApiKeyCommand` y `ListDeveloperApiScopesQuery`.
- [x] **T2.4**: Agregar tests unitarios en `EcuNexo.Business.UnitTests` para `PermissionAccessGuard` con API Keys (aislamiento de tenant, bloqueo por módulo no contratado, bloqueo por scope faltante) y generación/verificación criptográfica.

## Fase 3: API, Autenticación M2M y OpenAPI Externo (`EcuNexo.Api`)
- [x] **T3.1**: Implementar `TenantApiKeyAuthenticationHandler` (validación SHA-256 en tiempo constante + caché + resolución automática de `TenantId`) y actualizar `HttpCallerContext`.
- [x] **T3.2**: Crear endpoints `/api/v1/tenants/{tenantId:guid}/api-keys` y `/api/v1/tenants/{tenantId:guid}/api-keys/scopes`.
- [x] **T3.3**: Configurar el documento OpenAPI segregado `external-v1` (`/openapi/external-v1.json`) con `ExternalDeveloperApiOpenApiTransformer` y marcar los endpoints públicos para empresas (Catálogo, Inventario, Bodegas, Clientes, Pedidos, Precios).

## Fase 4: Portal de Desarrolladores en Admin (`Cliente/ecunexo_admin`)
- [x] **T4.1**: Crear cliente API y tipos en `ecunexo_admin` (`developerApiKeysApi.ts`) para gestionar API Keys y consultar scopes disponibles.
- [x] **T4.2**: Construir la página **API y Desarrolladores** (`DeveloperApiPage.tsx`) con `PageHeader`, `StatCard`, `SectionCard` (guía rápida + `TenantId` + link al Portal Scalar `external-v1`), `DataGrid` de llaves y diálogo de creación/revelación única del token.
- [x] **T4.3**: Registrar ruta (`/organizacion/api`) y entrada en navegación (`MenuCatalogSeedData`), y verificar compilación (`tsc -b`, `pnpm build`, `dotnet test`).

## Fase 5: Sitio Público de Documentación (`/developers`) y Enriquecimiento Scalar (`external-v1`)
- [x] **T5.1**: Enriquecer `ExternalDeveloperApiOpenApiTransformer` con guías Markdown completas, descripciones por Tag (`Catalog`, `Pricing`, `Inventory`, `Warehousing`, `Customers`, `Ecommerce`, `Storefront`) y `ExternalDeveloperOperationTransformer` (seguridad `ApiKeyAuth` por operación y respuestas estándar `401`/`403`).
- [x] **T5.2**: Configurar `MapScalarApiReference` en `Program.cs` para personalizar el portal interactivo `/scalar/external-v1`.
- [x] **T5.3**: Construir el sitio público `/developers` (`PublicDevelopersPortalPage.tsx`) en `ecunexo_admin` accesible sin login (guías de arquitectura, ejemplos multi-lenguaje cURL/TS/C#/Python, catálogo de scopes, diccionario de errores y referencia interactiva Scalar embebida).

