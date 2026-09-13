# EcuNexo — Contexto Activo del Proyecto (Active Memory)

> Este archivo mantiene el hilo operativo del proyecto para ahorrar tokens y permitir que cualquier sesión retome el trabajo con precisión inmediata. Se actualiza al completar o cambiar de hito.

---

## 1. Estado Actual del Repositorio

* **Rama Activa:** `main`.
* **Última Versión Publicada:** `v0.21.1`.
* **Hitos Recientes Completados:**
  - **Despliegue Desacoplado y Clave Pública de Licencias Integrada (`v0.21.1`):**
    - **Clave Pública RSA Integrada:** Empaquetado de `license-public.pem` dentro del proyecto `EcuNexo.Api` y `SigningPublicKeyPem` embebido en `appsettings.json`, eliminando la necesidad de variables o volúmenes externos para la verificación de licencias.
    - **Desacoplamiento de Volúmenes en Docker Compose:** Eliminación de la dependencia forzada de `${LICENSE_KEYS_HOST_PATH}:/keys:ro` en `docker-compose.yml` y configuración de valores por defecto seguros para prevenir fallos de inicio en Portainer ante variables no definidas.
    - **Resolución de Error 502 Cloudflare / Nginx Upstream:** Identificación de `Connection refused` en `http://172.22.0.3:8080` debido al rechazo por formato de permisos en `MenuCatalogSeedData` (`permission.code.format` por uso de guiones bajos en `purchases.expense_types.*`) y normalización al estándar `purchases.expenses.*`.
    - **Alineación de Layout y Cuadrícula de KPIs (`.ecu-stat-grid`):** Corrección de apilamiento vertical de tarjetas `StatCard` en `ImportPurchasesPage.tsx` mediante el contenedor estándar `.ecu-stat-grid` y layout fluido `.ecu-dashboard-layout--fluid`. Actualización de la skill `glubox-enterprise-ui` y regla 2 de `GEMINI.md`.
    - **Registro de Handlers CQRS en Inyección de Dependencias (`EcuNexo.Business/DependencyInjection.cs`):**
      * Corrección de `InvalidOperationException` al actualizar/eliminar categorías de gasto registrando `UpdateExpenseTypeHandler` y `DeleteExpenseTypeHandler` en `services.AddBusiness()`.
      * Creación de test automatizado por reflexión `DependencyInjectionTests.cs` en `EcuNexo.Business.UnitTests` que valida que el 100% de los `ICommandHandler<,>` e `IQueryHandler<,>` concretos estén registrados en el contenedor IoC (76 pruebas en Business y 182 en Core pasando al 100%).
  - **Vista Dedicada de Importación de Compras & Auditoría Preventiva SRI (`/compras/documentos/importar`):**
    - **Transición de Modal a Vista Propia:** Reemplazo de `ParseXmlModal` por una pantalla completa dedicada con amplio espacio horizontal y vertical para procesar tanto cargas individuales como masivas por lotes de múltiples archivos XML simultáneos.
    - **Auditoría Preventiva del SRI (`SriPurchaseAuditor` & `SriValidationReport`):**
      * Verificación algorítmica de la Clave de Acceso de 49 dígitos con el algoritmo Módulo 11 (ponderaciones 7 a 2) alertando si el dígito verificador está corrupto o mal generado por el emisor.
      * Detección de estado ante el SRI y contingencia: Alertas preventivas para comprobantes sin constancia oficial de autorización (`<autorizacion> / <estado>AUTORIZADO</estado>`), emitidos durante caídas o indisponibilidad del SRI, comprobantes en proceso o devueltos/rechazados.
      * Auditoría aritmética de cuadre: Verificación entre la suma de bases imponibles (tarifa 0%, gravada, no objeto, exenta), IVA liquidado, descuentos e Importe Total declarado en la cabecera.
      * Verificación de vigencia de tarifas SRI: Detección de la tarifa general vigente de IVA del 15% (desde abril 2024), 5% construcción y tarifa 0%, con advertencias preventivas si el proveedor emitió con tarifas desfasadas (12% o 14%).
      * Soporte para Facturas Físicas Preimpresas: Flexibilización en `Purchase.Create` para aceptar números de autorización de 10 dígitos (imprenta SRI) y 49 dígitos (electrónica).
    - **Cola de Facturas en Lote & Homologación de Catálogo:**
      * Grid de facturas en cola con selector múltiple, badges de auditoría SRI (`Válida SRI`, `Advertencia / Contingencia`, `Inconsistente`), inspección de cada comprobante, vinculación directa a productos de catálogo (`catalog_items`), asignación de bodegas físicas y registro consolidado en lote.
    - **Auditoría Global de Selectores de Fecha (`DateBox` de Glubox en todo el sistema):**
      * Se auditó todo el repositorio frontend en búsqueda de inputs nativos `type="date"` que desplegaban el datepicker nativo transparente y desalineado del navegador.
      * Reemplazo sistemático por `<DateBox ... />` de Glubox en todos los formularios identificados:
        1. [`ExpenseTypeModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypeModal.tsx) (Vigencia Desde y Vigencia Hasta).
        2. [`PurchaseProformaModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaModal.tsx) (Fecha de Emisión y Válida hasta).
        3. [`PurchaseProformaCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaCreatePage.tsx) (Fecha de Emisión y Vencimiento / Vigencia de Precios).
        4. [`InvoiceIssuerFields.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/InvoiceIssuerFields.tsx) (Fecha de Emisión en emisión de facturas).
        5. [`ImportPurchasesPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ImportPurchasesPage.tsx) (Fecha de Emisión en ingreso de factura física).
      * Con esta normalización, el 100% de los campos de fecha del frontend utilizan los componentes oficiales de Glubox (`DateBox` y `RangeDateBox`).
    - Detección determinista por dígito 24 de la clave de acceso de 49 dígitos (`accessKey[23] === '1'` para Pruebas, `'2'` para Producción).
    - **RIDE PDF:** Incorporación de banner superior prominente de alerta (`AMBIENTE DE PRUEBAS — DOCUMENTO SIN VALIDEZ TRIBUTARIA`), marca de agua diagonal de seguridad (`PRUEBAS — SIN VALIDEZ TRIBUTARIA`), indicativo en cabecera junto al número (`[AMBIENTE DE PRUEBAS — SIN VALIDEZ TRIBUTARIA]`), y etiquetado resaltado en el campo Ambiente (`PRUEBAS (SIN VALIDEZ TRIBUTARIA)`).
    - **Grilla de Comprobantes (`FacturasGrid`):** Nueva columna `Ambiente` con badge específico (`🧪 Pruebas (Sin validez)`, `🚀 Producción`, `Borrador`) y tooltip explicativo.
    - **Modal de Previsualización (`InvoiceRidePreviewPopup`):** Badges dinámicos según el ambiente del comprobante con alertas contextuales sobre la validez fiscal.
    - **Dashboard de Comprobantes (`ComprobantesPage`):** Desglose explícito en las KPI StatCards de comprobantes en Producción vs Pruebas.
  - **Corrección de Configuración Legal y Firma SRI (`ContabilidadSriConfigPage`):**
    - Implementación completa de `UpdateTenantSriLegalHandler` en el backend (reemplazando el stub que devolvía 403 `Results.Forbid()`).
    - Soporte para `TradeName` (Nombre Comercial) en comando y validaciones.
    - Ajuste en frontend para invocar el endpoint `/api/v1/tenants/{tenantId}/sri-legal` directamente.
    - Corrección en el cálculo de completitud de la barra de progreso (100% y badge "Listo" al tener datos fiscales y certificado digital válido).
  - **Corrección y Soporte Total de XML de Facturas de Compra SRI (`SriPurchaseXmlParser`):**
    - Soporte completo para XML envueltos en respuestas oficiales del WebService SRI (`<ns2:RespuestaAutorizacion>` y `<autorizacion>`), con comprobantes embebidos en CDATA o texto escapado (`&lt;factura...`).
    - Navegación agnóstica de namespaces XML para elementos y atributos SRI (`infoTributaria`, `infoFactura`, `detalles`, `impuestos`).
    - Detección y decodificación automática de entidades HTML/XML si el usuario copia texto escapado.
    - Respaldo de dirección matriz con `dirEstablecimiento` si `dirMatriz` no viene en `infoTributaria`.
    - Auto-creación transparente del proveedor en el directorio (`ParseXmlModal.tsx`) si el RUC/Cédula es nuevo, resolviendo el `supplierId` antes de registrar la compra.
  - **Fortalecimiento de Reglas de Negocio en Compras (Fases 1 y 2):**
    - **Proveedores:** Flexibilización de correo electrónico en [`Supplier.Create`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Core/Purchases/Supplier.cs) y `Update` (correo opcional para total compatibilidad con XMLs del SRI que no incluyen el emisor; validación de formato solo si se proporciona).
    - **Facturas de Compra:** Validación de formato SRI (`^\d{3}-\d{3}-\d{9}$`) con auto-normalización de números continuos de 15 dígitos (`001002000123456` -> `001-002-000123456`), prohibición de fechas de emisión futuras, e imposibilidad de subtotales/totales negativos.
    - **Recepción en Bodega y Kárdex (`ReceivePurchaseModal.tsx`):** Selector de productos de catálogo por línea para vincular cualquier ítem que no haya sido homologado previamente, asegurando la creación correcta del `InventoryDocument` de ingreso y la actualización del costo promedio ponderado en el kárdex contable.
    - **Gestión Completa, Edición y Vigencia del Catálogo de Categorías / Conceptos de Compra SRI (`expense_types`):**
    - **Entidad de Dominio (`ExpenseType`):** Incorporación de campos oficiales de porcentaje de retención (`RetentionPercentage`), fecha inicio de vigencia (`ValidFrom`, ej. `2026-08-06`) y fin de vigencia (`ValidUntil`), con validación de invariantes de fechas y porcentaje (0-100%).
    - **Base de Datos & Migración EF Core:** Aplicada migración `20260913175114_AddVigenciaAndPercentageToExpenseTypes` en PostgreSQL schema `purchases.expense_types`.
    - **CQRS Handlers:** Implementados `UpdateExpenseTypeHandler` y `DeleteExpenseTypeHandler` (protección de conceptos `IsSystem` contra borrado destructivo pero permitiendo desactivación y edición de nombres/tarifas; descarte físico sólo si no existen compras asociadas, y desactivación preventiva si ya fue usado).
    - **Endpoints API:** `PUT` y `DELETE` en `/api/v1/tenants/{tenantId}/purchases/expense-types/{id}` expuestos y documentados en Swagger.
    - **Frontend (`ExpenseTypeModal.tsx` & `ExpenseTypesListPage.tsx`):** Modal completo Glubox para crear y editar conceptos, selector de códigos AIR del SRI con autocompletado de porcentajes y fechas vigentes (desde agosto 2026), columnas en DataGrid con `% Retención AIR`, `Vigencia SRI` y botones de acción (Editar y Desactivar/Eliminar con confirmación segura).
  - **Seguridad & Endurecimiento de Permisos RBAC en Compras:**
    - Eliminado el bypass temporal de `facturacion.read` en endpoints de escritura (`POST`, `PUT`, `DELETE`, `/receive`, `/seed`, `/parse-xml`, `/approve`, `/reject`) en [`ExpenseTypeEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/ExpenseTypeEndpoints.cs), [`SupplierEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/SupplierEndpoints.cs), [`PurchaseEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/PurchaseEndpoints.cs) y [`PurchaseProformaEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/PurchaseProformaEndpoints.cs).
    - Alineados todos los componentes y páginas frontend de compras ([`ComprasDocumentosPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ComprasDocumentosPage.tsx), [`SuppliersListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/SuppliersListPage.tsx), [`ExpenseTypesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypesListPage.tsx), [`PurchaseProformasListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformasListPage.tsx), [`PurchaseProformaCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaCreatePage.tsx), [`PurchaseWithholdingsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseWithholdingsListPage.tsx), [`PurchaseSettlementsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementsListPage.tsx)) para evaluar estrictamente los permisos granulares `purchases.*` en lugar de conceder accesos por facturación de ventas.
    - Menú padre "Compras" en [`MenuCatalogSeedData.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs) configurado con permisos abiertos para que cualquier usuario con permiso a al menos una de las subsecciones (facturas, proveedores, proformas, retenciones o categorías) pueda acceder a su área autorizada sin exigir forzosamente `purchases.documents.read`.
  - **Seguridad:**
    - Eliminado archivo `.pem` del repositorio, configurado `.gitignore` y `appsettings.Development.local.json`.

---

## 2. Objetivos y Alcance del Módulo de Compras

1. **Directorio de Proveedores (`/compras/proveedores`):**
   * Maestro de proveedores con validación de identificación (RUC Sociedades Módulo 11, RUC Personas Módulo 10, Cédula).
   * Parámetros tributarios SRI: Régimen General, RIMPE Emprendedor, RIMPE Negocio Popular, Contribuyente Especial, Agente de Retención.
   * Gestión de proformas/cotizaciones comerciales por proveedor con anexos PDF/imagen en Cloud Storage.
2. **Catálogo y Tipos de Gasto SRI (`expense_types`):**
   * Semillero (Seed) de gastos estándar para e-commerce y empresas: Mercadería para venta (Inventario), Empaque y embalaje, Publicidad/Marketing digital, Hosting/Cloud SaaS, Honorarios, Arriendos, Servicios básicos, Activo fijo.
   * Mapeo transparente hacia los códigos de sustento de crédito tributario del SRI (Tabla 5 ATS: `01`, `02`, `03`).
3. **Ingreso y Sustentación de Facturas de Proveedores:**
   * Importación/parseo automático de XML de facturas electrónicas SRI (Tipo 01) y consulta por clave de acceso de 49 dígitos.
   * Afectación automática y directa a Bodegas e Inventario físico (Ingreso de stock y kárdex promedio ponderado).
4. **Emisión de Comprobantes de Retención Electrónica (SRI Tipo 07):**
   * Estructura XML versión 2.0.0 (Anexo 10 ATS de la Ficha Técnica Offline v2.32).
   * Cálculo automático de retenciones de Renta (códigos 312, 343, 304, 303/3440, etc.) e IVA (30%, 70%, 100%).
   * Firma digital XAdES-BES (`.p12`), transmisión SOAP y emisión de RIDE PDF.
5. **Liquidaciones de Compra (SRI Tipo 03):**
   * Para adquisición a personas sin RUC autorizadas por normativa ecuatoriana.

---

## 3. Decisiones de Arquitectura & Rutas

* **Frontend (`ecunexo_admin`):**
  * Rutas bajo `/compras/*`:
    * `/compras/documentos` (Listado unificado con pestañas o filtros por tipo).
    * `/compras/proveedores` (Directorio de proveedores y fichas de contacto).
    * `/compras/proformas` (Gestión de cotizaciones por proveedor).
    * `/compras/gastos-tipos` (Catálogo maestro de tipos de gasto y sustentos SRI).
  * Estilo y layout: Cumplimiento estricto de `glubox-enterprise-ui` (PageHeader → KPI StatCards → SectionCard → DataGrid).
* **Backend (`ecunexo_api`):**
  * Dominio en `EcuNexo.Core/Purchases/` o subdominios `Suppliers`, `Expenses`, `Purchases`.
  * Persistencia en PostgreSQL mediante EF Core con migraciones versionadas.
  * Reutilización del motor de firma XAdES-BES y web services SRI del subsistema de facturación.

---

## 4. Skills de Consulta Rápida (Disponibles en `.agents/skills/`)

* [`compras-ecuador-sri`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/compras-ecuador-sri/SKILL.md): Ficha Técnica SRI v2.32, XML Retención v2.0.0, códigos ATS e impuestos.
* [`proveedores-proformas`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/proveedores-proformas/SKILL.md): Entidad proveedor, validaciones y ciclo de vida de proformas.
* [`inventario-bodegas-kardex`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/inventario-bodegas-kardex/SKILL.md): Enlace de compras con kárdex ponderado y saldos por bodega.
* [`ecommerce-pedidos-stock`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/ecommerce-pedidos-stock/SKILL.md): Stock disponible para la tienda web tras compras.
* [`glubox-enterprise-ui`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/glubox-enterprise-ui/SKILL.md): Directrices visuales y componentes atómicos glubox.
* [`semantic-versioning`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/semantic-versioning/SKILL.md): Protocolo de versionamiento semántico bajo demanda explícita.
* [`licenciamiento-modulo-prompt`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/licenciamiento-modulo-prompt/SKILL.md): Generación obligatoria de prompts estandarizados para el módulo de licencias al crear nuevos módulos de negocio.

---

## 5. Plan de Ejecución Inmediato (Fases con Testing Obligatorio)

* [x] **Fase 1: Dominio y Base de Datos (Proveedores, Tipos de Gasto SRI & Proformas):**
  * Entidades `Supplier`, `ExpenseType` (con seed inicial SRI de 8 categorías ATS) y `PurchaseProforma`.
  * Repositorios `ISupplierRepository`, `IExpenseTypeRepository`, `IPurchaseProformaRepository`.
  * Migración EF Core `20260913023206_AddPurchasesAndSuppliersModule` (esquema `purchases`).
  * **Unit Tests (Core):** `SupplierTests.cs` y `ExpenseTypeAndProformaTests.cs` en `EcuNexo.Core.UnitTests` (147 pruebas en verde).
* [x] **Fase 2: Endpoints y CQRS Handlers en Backend:**
  * Comandos y queries para CRUD de proveedores, siembra/listado de tipos de gasto y flujo de proformas (Draft -> Approved/Rejected).
  * Endpoints REST en `SupplierEndpoints.cs`, `ExpenseTypeEndpoints.cs`, `PurchaseProformaEndpoints.cs` con políticas de permisos `purchases.*` y catálogo de menús (`MenuCatalogSeedData.cs`).
  * **Unit Tests (Business):** `SupplierHandlersTests.cs`, `ExpenseTypeHandlersTests.cs`, `PurchaseProformaHandlersTests.cs` en `EcuNexo.Business.UnitTests` (53 pruebas en verde, total backend 200 pruebas).
* [x] **Fase 3: Frontend UI Directorio de Proveedores, Proformas & Tipos de Gasto:**
  * Validador SRI en tiempo real: `ecuadorTaxIdValidator.ts` (Módulo 10 y Módulo 11 para Cédula, RUC Natural, RUC Privada, RUC Pública, Pasaporte).
  * Cliente API completo: `purchasesApi.ts`.
  * Vistas y modales cumpliendo Enterprise UI / glubox:
    * `/compras/proveedores`: `SuppliersListPage.tsx` (KPIs, DataGrid, búsqueda, modal `SupplierModal.tsx` con validación RUC interactiva).
    * `/compras/proformas`: `PurchaseProformasListPage.tsx` (KPIs, estados, modal `PurchaseProformaModal.tsx` con desglose dinámico de ítems e impuestos IVA 15%/5%/0%).
    * `/compras/gastos`: `ExpenseTypesListPage.tsx` (KPIs, códigos ATS, botón de siembra oficial SRI).
  * Rutas configuradas en `routes.tsx` e iconos en `sidebarIcons.tsx`.
  * **Frontend Tests:** Suite Playwright `tests-ui/comun/compras-ui.spec.ts` (13 pruebas unitarias y de navegación E2E pasando al 100%, build de Vite en verde sin errores de tipado).
* [x] **Fase 4: Registro de Facturas de Compra & Parseo XML SRI:**
  * **Backend:**
    * Entidades de dominio `Purchase` y `PurchaseItem` en `EcuNexo.Core/Purchases/`.
    * Servicio `SriPurchaseXmlParser` que interpreta comprobantes `<factura>` (v1.0.0, v1.1.0) y sobres SOAP SRI `<autorizacion><comprobante><![CDATA[...]]></comprobante></autorizacion>`, extrayendo emisor, comprador, clave de acceso de 49 dígitos, fechas, desglose tributario y líneas de productos.
    * Persistencia EF Core (`PurchaseConfiguration.cs`, esquema `purchases`, migración `20260913030153_AddPurchasesInvoicesAndItems.cs`).
    * CQRS Commands & Queries: `ParseSriPurchaseXmlCommand`, `CreatePurchaseCommand`, `ReceivePurchaseCommand` (enlaza y aprueba automáticamente documentos de recepción física actualizando existencias y kárdex promedio ponderado por bodega), `ListPurchasesQuery` y `GetPurchaseByIdQuery`.
    * Endpoints REST en `PurchaseEndpoints.cs` (`/api/v1/tenants/{tenantId}/purchases/documents`).
    * **Backend Unit Tests:** 211 tests en verde (154 Core + 57 Business).
  * **Frontend:**
    * Funciones API en `purchasesApi.ts` (`listPurchases`, `getPurchaseById`, `parseSriPurchaseXml`, `createPurchase`, `receivePurchase`).
    * Vistas y modales:
      * `ComprasDocumentosPage.tsx`: PageHeader (sin botones duplicados, Regla 3), KPIs (Total Facturas, Mercadería Recibida, En Borrador, Total Facturado), filtros y DataGrid.
      * `ParseXmlModal.tsx`: Carga/pegado de XML SRI, análisis automático, homologación con ítems del catálogo y selección de bodega.
      * `ReceivePurchaseModal.tsx`: Recepción física de mercadería en almacén y afectación a kárdex.
      * `PurchaseDetailModal.tsx`: Consulta detallada de la factura, impuestos y líneas.
    * **Frontend Tests:** 17 tests unitarios y E2E en Playwright (`tests-ui/comun/compras-ui.spec.ts`) pasando al 100%, `npm run build` con 0 errores TypeScript.
* [x] **Fase 5: Arquitectura de Firma Electrónica (.p12) Cifrada en Base de Datos (AES-256-GCM):**
  * **Almacenamiento Cifrado en PostgreSQL:**
    * Entidad `TenantSigningCertificate` en `EcuNexo.Core/Tenancy/` con campos `encrypted_data` (bytea), `encrypted_password` (bytea), `nonce` (12 bytes), `tag` (16 bytes) y metadatos del titular (`subject`, `issuer`, `valid_from`, `valid_to`, `subject_tax_id`, `serial_number`, `original_file_name`, `is_active`).
    * Servicio de cifrado autenticado `AesGcmCertificateEncryptionService` (AES-256-GCM con clave maestra derivada o por configuración).
    * Validador en memoria `SigningCertificateValidator` usando `X509CertificateLoader.LoadPkcs12` (.NET 10) con `EphemeralKeySet`, comprobando presencia de clave privada, vigencia y extrayendo el RUC/titular.
    * Repositorio `TenantSigningCertificateRepository` y mapeo EF Core en tabla `tenancy.tenant_signing_certificates`.
    * Migración aplicada: `20260913053039_AddTenantSigningCertificates`.
    * Endpoints REST en `TenantSigningCertificateEndpoints.cs`:
      * `POST /api/v1/tenants/{tenantId}/signing-certificate`: Carga y validación en memoria del archivo `.p12`/`.pfx`, cifrado AES-GCM y persistencia.
      * `GET /api/v1/tenants/{tenantId}/signing-certificate/status`: Estado del certificado, titular, RUC, días restantes y alerta de expiración.
    * **Backend Unit Tests:** 238 tests en verde al 100% (168 Core + 70 Business), incluyendo pruebas de ida y vuelta de cifrado AES-256-GCM, detección de datos/tags alterados y validación PKCS#12 en memoria.
  * **Frontend (`ecunexo_admin`):**
    * Métodos `getSigningCertificateStatus` y `uploadSigningCertificate` en `src/services/tenantApi.ts`.
    * Interfaz renovada en `SriSignatureSection.tsx` (`Ajustes de Empresa -> Facturación Electrónica`) con tarjeta informativa del certificado activo (AES-256-GCM, titular, RUC, vigencia, días restantes con StatusBadge) y dropzone con botón "Cargar y Validar Firma".
    * Banners dinámicos en `PurchaseWithholdingsListPage.tsx` y `PurchaseSettlementsListPage.tsx` que reflejan en tiempo real el estado de la firma electrónica.
    * `npm run build` en verde con 0 errores TypeScript.
* [ ] **Fase 6: Motor de Emisión de Retenciones SRI (XML 07) & Liquidaciones (XML 03):**
  * Generación de comprobante de retención electrónica versión 2.0.0 (Anexo 10 ATS v2.32), cálculo automático de IR/IVA según condición tributaria del proveedor, firma digital XAdES-BES tomando el `.p12` descifrado en memoria desde la base de datos, transmisión WebServices SOAP SRI y generación de RIDE.
