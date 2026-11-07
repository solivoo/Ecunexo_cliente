# Feature Specification: API Pública y Portal de Desarrolladores por Empresa (Tenant Developer API)

- **Feature ID**: `001-tenant-developer-api`
- **Status**: Draft
- **Created**: 2026-11-07
- **Bounded Contexts**: `Identity` (API Keys & Scopes), `Tenancy` (Entitlements), `Api` (OpenAPI & Scalar External Docs), `Admin` (Gestión de Credenciales y Portal)

---

## 1. Contexto y Problema (`Why`)

Las empresas (tenants) que contratan EcuNexo necesitan integrar sus propios sistemas (e-commerce a medida, aplicaciones móviles propias, ERPs externos, automatizaciones o BI) consumiendo directamente los datos y operaciones de su organización en EcuNexo.

Actualmente:
1. La autenticación depende de sesiones de usuario (`Bearer JWT` o dev headers) o de rutas anónimas acotadas al storefront público (`/api/v1/public/...`).
2. El documento OpenAPI actual (`/openapi/v1.json` y `/scalar/v1`) expone **todos** los endpoints internos del monolito (incluyendo plataforma, licencias, onboarding e identidad interna), lo cual no es apto ni seguro como documentación para clientes externos.
3. Las empresas no tienen una pantalla en `ecunexo_admin` para generar/revocar credenciales Machine-to-Machine (API Keys) con permisos acotados (*scopes*) ni para consultar su documentación interactiva lista para copiar y pegar.

---

## 2. Escenarios de Usuario (`What`)

### US-1: Generación y Gestión de API Keys por Empresa
- **Como** administrador de una empresa (tenant) en `ecunexo_admin`,
- **Quiero** crear una API Key con nombre descriptivo, fecha de expiración opcional y una selección de permisos (*scopes*, ej. `catalog:read`, `inventory:read`, `ecommerce.orders:read`),
- **Para** conectar mi infraestructura externa sin compartir contraseñas de usuarios humanos y pudiendo revocar la llave en cualquier momento sin afectar a otras integraciones.
- **Criterios de Aceptación**:
  1. El secreto completo (`ecx_live_<prefix>_<random>`) se muestra **una única vez** al momento de crearse; en base de datos solo se almacena el `KeyPrefix` y el `KeyHash` (SHA-256).
  2. La tabla muestra el nombre, prefijo, scopes asignados, fecha de creación, último uso (`LastUsedAt`), expiración y estado (Activa / Expirada / Revocada).
  3. Revocar una API Key invalida inmediatamente cualquier petición subsiguiente con esa llave.

### US-2: Consumo Seguro M2M con Aislamiento Multi-Tenant y Licenciamiento
- **Como** desarrollador de una empresa cliente,
- **Quiero** autenticar mis peticiones HTTP enviando la cabecera `X-Api-Key: ecx_live_...`,
- **Para** consumir los endpoints autorizados de mi empresa con garantía de que mis peticiones están aisladas a mi `TenantId` y respetan los módulos contratados en mi plan.
- **Criterios de Aceptación**:
  1. Si la ruta incluye `{tenantId}`, debe coincidir estrictamente con el `TenantId` de la API Key; de lo contrario responde `403 Forbidden` (`auth.tenant.mismatch`).
  2. Si la API Key no tiene el permiso requerido por el endpoint, responde `403 Forbidden` (`auth.api_key.scope_denied`).
  3. Si la empresa no tiene contratado el módulo asociado al permiso (`ModuleEntitlements`), responde `403 Forbidden` (`module.not_entitled`).
  4. Las peticiones con API Key tienen su propio límite de tráfico (*Rate Limiting* particionado por API Key / Tenant).

### US-3: Documentación Interactiva Externa (OpenAPI + Scalar para Clientes)
- **Como** equipo técnico de una empresa cliente,
- **Quiero** abrir el portal de documentación de la API de EcuNexo filtrado exclusivamente para integraciones de clientes,
- **Para** explorar los contratos disponibles (Catálogo, Inventario, Bodegas, Clientes, Pedidos, Precios), ver ejemplos en cURL/JS/C#/Python y probar peticiones con mi `X-Api-Key`.
- **Criterios de Aceptación**:
  1. Existe un documento OpenAPI separado (`/openapi/external-v1.json`) que incluye **únicamente** los endpoints habilitados para consumo externo de empresas.
  2. El esquema de seguridad del documento externo documenta `ApiKeyAuth` (`X-Api-Key` en header).
  3. Desde `ecunexo_admin` (sección **Desarrolladores / API**), la empresa ve el enlace directo al Portal Interactivo Scalar (`/scalar/external-v1`), su `TenantId` listo para copiar y la guía rápida de conexión.

---

## 3. Reglas No Negociables y Casos de Borde (`Constraints`)

1. **Cero texto plano en BD**: Prohibido guardar el token completo de la API Key. Se usa comparación criptográfica en tiempo constante (`CryptographicOperations.FixedTimeEquals`) sobre el hash SHA-256.
2. **Prohibición de Escalación de Privilegios**: Una API Key solo puede recibir permisos de un catálogo seguro de integraciones (nunca permisos de administración de plataforma, licencias o gestión de otras API Keys).
3. **Fuente Única de Verdad**: El mismo `PermissionAccessGuard` y `ModuleEntitlementGuard` evalúan tanto usuarios JWT como llamadas por API Key.
4. **Escalabilidad (10x)**: La validación de API Key y actualización de `LastUsedAt` no debe bloquear cada request con escrituras síncronas pesadas (actualización desacoplada o con ventana de throttling).
