# EcuNexo — Contexto Activo del Proyecto (Active Memory)

> Este archivo mantiene el hilo operativo del proyecto para ahorrar tokens y permitir que cualquier sesión retome el trabajo con precisión inmediata. Se actualiza al completar o cambiar de hito.

---

## 1. Estado Actual del Repositorio

* **Rama Activa:** `main`.
* **Última Versión Publicada:** `v0.19.0`.
* **Hito Completado:** **Aislamiento de Firma Digital (.p12), Bloqueo de Emisión SRI y RIDE Preview:**
  - **Aislamiento total de firmas:** Eliminada la asignación/fallback automática de la firma default de ecunexo (`EnsureInfisicalCertificateBoundAsync`) en `Billing.Api`. Ningún emisor puede firmar sin su propio certificado `.p12` cargado y validado.
  - **Bloqueo preventivo en frontend (`FacturaEmitirPage`):** Si la empresa no tiene un certificado `.p12` configurado o está expirado, se bloquean los botones "Emitir (SRI)" y "Solo firmar", mostrando un banner de alerta con redirección a Ajustes de Empresa.
  - **Modo Previsualización RIDE Exclusivo:** Se mantiene habilitado el botón "Previsualizar RIDE" (PDF) y la validación de estructura XML ("Solo validar").
  - **Marca de agua y leyenda en PDF RIDE:** Si el comprobante es borrador o no cuenta con autorización del SRI, se imprime en el encabezado `PREVISUALIZACIÓN — DOCUMENTO SIN VALIDEZ TRIBUTARIA`, con marca de agua diagonal y estado `NO AUTORIZADO`.
  - **Optimización de proporciones en el pie del RIDE (`RideFacturaFooter` / `rideFacturaStyles`):** El cuadro de subtotales e impuestos se redujo a `width: 215` (más angosto), permitiendo que la columna izquierda (información adicional, dirección, correo y formas de pago) se expanda con `flex: 1.5` sin solapamientos.
  - **Cumplimiento normativo y legal:** Modal y términos click-wrap con respaldo en LOPDP y Ficha Técnica SRI en onboarding y login.

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
