# EcuNexo — Contexto Activo del Proyecto (Active Memory)

> Este archivo mantiene el hilo operativo del proyecto para ahorrar tokens y permitir que cualquier sesión retome el trabajo con precisión inmediata. Se actualiza al completar o cambiar de hito.

---

## 1. Estado Actual del Repositorio

* **Rama Activa:** `main`.
* **Última Versión Publicada:** `v0.23.1`.
* **Hitos Recientes Completados:**
  - **Módulo de Guías de Remisión Electrónicas SRI (Tipo 06) — Concluido al 100% (Backend, Frontend & E2E):**
    - **Backend (`ecunexo_api`):**
      * Dominio Core (`EcuNexo.Core`): Agregado raíz `RemisionGuide`, entidad `RemisionGuideItem`, enums `RemisionGuideStatus` (Draft, Issued, Authorized, InTransit, Delivered, Cancelled).
      * Generador oficial de XML SRI `<guiaRemision version="1.1.0">` (`SriRemisionGuideXmlGenerator.cs`) con soporte para datos de transportista, placa vehicular, fechas de inicio/fin de traslado, destinatario, motivo de traslado, documento de sustento tributario y desglose de mercadería.
      * Clave de Acceso SRI de 49 dígitos con algoritmo Módulo 11 para tipo comprobante `06`.
      * Persistencia EF Core: `RemisionGuideConfiguration` y `RemisionGuideItemConfiguration` en esquema `billing` (`billing.remision_guides`, `billing.remision_guide_items`). Migración `20260914013818_AddRemisionGuidesModule`. Repositorio `IRemisionGuideRepository` / `RemisionGuideRepository`.
      * CQRS Handlers: `CreateRemisionGuideCommand` (autonumeración secuencial, generación de clave y XML), `UpdateRemisionGuideStatusCommand` (transiciones logísticas a `InTransit`, `Delivered`, `Cancelled`), `ListRemisionGuidesQuery` (filtros y cálculo reactivo de KPIs), `GetRemisionGuideByIdQuery` (detalle y descarga XML). Registro explícito en `DependencyInjection.cs`.
      * Endpoints REST V1: `GET /api/v1/tenants/{tenantId}/billing/remision-guides`, `POST`, `PATCH /{id}/status`, `GET /{id}`, `GET /{id}/xml`. Permisos RBAC conformes a regex (`facturacion.guias.remision.read`, `facturacion.guias.remision.create`) y menú con icono `truck` en `MenuCatalogSeedData.cs`.
      * Tests Unitarios Backend: 308/308 tests pasando al 100% (208 Core + 100 Business).
    - **Frontend (`ecunexo_admin`):**
      * Servicios API y tipos TypeScript estrictos en `remisionGuidesApi.ts`.
      * Vista canónica Enterprise M3 [`RemisionGuidesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/RemisionGuidesListPage.tsx) bajo `/facturacion/guias-remision` con PageHeader, 4 KPIs en `.ecu-stat-grid` (Total Registradas, Autorizadas SRI, En Tránsito, Entregadas), filtros `OptionGroup`, DataGrid Glubox, acciones logísticas y modal de inspección RIDE.
      * Vista dedicada de emisión [`RemisionGuideCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/RemisionGuideCreatePage.tsx) bajo `/facturacion/guias-remision/nueva` (Regla 9 sin modales) con 5 secciones de `SectionCard` (Emisión y Logística, Transportista, Destinatario y Ruta, Documento Sustento, Mercadería Transportada), banner de firma digital y validaciones preventivas.
      * Prevención de duplicidad de botones en `ComprobantesPage.tsx` (Regla 3).
      * Tests E2E en Playwright: 5/5 tests pasando al 100% en `tests-ui/comun/guias-remision-ui.spec.ts`.
  - **Herencia de Credenciales Root en Creación de Empresa & Planes Transporte (`v0.23.1`):**
    - **Backend (`ecunexo_api`):** `ProvisionSubscriptionCompanyHandler` permite omitir `OwnerPassword` heredando automáticamente el hash de contraseña del usuario titular root (`account.PasswordHash`). `OwnerEmail`, `OwnerName` y `OwnerPhone` heredan también por defecto los datos del titular si no son provistos. `ProvisionSubscriptionCompanyValidator` condiciona la longitud de contraseña a su presencia. Tests unitarios en `ProvisionSubscriptionCompanyHandlerTests.cs` (300 tests backend pasando al 100%).
    - **Frontend (`ecunexo_admin`):** Actualización de `CreateCompanyPage.tsx` eliminando la obligatoriedad de crear y confirmar una nueva contraseña para la empresa. Incorporación de banner informativo M3 confirmando el acceso unificado del titular con sus credenciales actuales y toggle opcional `CheckButton` para asignar contraseñas diferenciadas si el usuario lo desea.
    - **Documentación de Planes Sector Transporte:** Redacción de `18-planes-y-precios-sector-transporte-ecuador.md` con matriz comercial (Plan Local $428/año vs Plan Empresa $806/año) y auditoría de cumplimiento funcional ante el SRI.
  - **Fase 4: Estados Financieros Oficiales NIIF para PYMES y SuperCompañías Ecuador (Balance General y Estado de Resultados Integral P&G) — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Query `GetFinancialStatementsQuery` con agregación de saldos por grupos contables oficiales (Activo 1, Pasivo 2, Patrimonio 3, Ingresos 4, Costos y Gastos 5).
      * Cálculo de Estado de Situación Financiera (Balance General): Activo Corriente y No Corriente, Pasivo Corriente y No Corriente, Patrimonio Neto, verificación de ecuación contable fundamental ($\text{Activo} = \text{Pasivo} + \text{Patrimonio}$) y cálculo de diferencia de cuadre.
      * Cálculo de Estado de Resultados Integral (P&G): Ingresos operacionales ordinarios (Ventas 15% y 0%), Costo de ventas, Utilidad Bruta, Gastos operacionales (Administración y Ventas/Marketing), Utilidad Operativa (EBITDA), 15% de Participación de Trabajadores (Art. 97 Código de Trabajo Ecuador), 25% de Provisión de Impuesto a la Renta Sociedades (SRI) y Utilidad Neta del Ejercicio.
      * Integración de la Utilidad Neta en el Balance General (Patrimonio cuenta 3.5.01) cerrando el ciclo contable de partida doble.
      * Endpoint REST V1 en `GET /api/v1/tenants/{tenantId}/accounting/financial-statements` con permisos RBAC conformes a regex (`contabilidad.balances.read`).
      * Tests unitarios exhaustivos en `FinancialStatementsTests.cs`: 298 tests backend pasando al 100% (203 Core + 95 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista dedicada [`FinancialStatementsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/FinancialStatementsPage.tsx) bajo `/contabilidad/balances` con selector de Año/Mes, 4 StatCards en `.ecu-stat-grid` (Total Activos, Total Pasivos, Patrimonio Neto y Utilidad Neta), banner de verificación de la ecuación fundamental NIIF, pestañas para Balance General y P&G con formato oficial, botón de impresión / PDF.
      * Servicios API y tipos TypeScript estrictos en `financialStatementsApi.ts`.
      * Registro de ruta en `routes.tsx` y menú en `MenuCatalogSeedData.cs`.
      * Tests E2E en Playwright: 8/8 tests pasando al 100% en `tests-ui/comun/contabilidad-ui.spec.ts`.
  - **Fase 3: Motor de Pre-declaración Tributaria SRI F104 / F103 y Conciliación S.A.S. — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Query `GetMonthlyTaxDeclarationQuery` con cálculo de casilleros oficiales SRI para Formulario 104 (Ventas 401, 411, 403, 429, 499; Compras 500, 510, 507, 529, 564, 569; Liquidación 601, 609, 615 y saldo neto a pagar/favor).
      * Cálculo de casilleros de Retenciones en la Fuente F103 (Bienes 312 [1.75%], Liquidaciones de compra 343 [1%]).
      * Conciliación S.A.S. para gerencia y contadora (Ventas netas, compras netas, margen bruto operativo, flujo tributario neto acumulado y auditoría de cuadre NIIF de asientos).
      * Endpoint REST V1 en `GET /api/v1/tenants/{tenantId}/accounting/tax-declarations/monthly` con permisos RBAC (`contabilidad.declaraciones.read`).
      * Tests unitarios exhaustivos en `TaxDeclarationsTests.cs`: 296 tests backend pasando al 100% (203 Core + 93 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista dedicada [`TaxDeclarationsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/TaxDeclarationsPage.tsx) bajo `/contabilidad/declaraciones` con selector de Año/Mes, 4 StatCards en `.ecu-stat-grid` (IVA Cobrado, IVA Soportado, Retenciones F103 y Saldo Neto), pestañas interactivas para F104 (desglose oficial SRI por casilleros), F103 y Ajuste de Cuentas Integral S.A.S. con auditoría de cuadre del Libro Diario.
      * Servicios API y tipos TypeScript estrictos en `taxDeclarationsApi.ts`.
      * Ruta configurada en `routes.tsx` y build limpio con `npm run build`.
      * Pruebas E2E de Playwright: 7/7 tests pasando al 100% en `tests-ui/comun/contabilidad-ui.spec.ts`.
  - **Fase 2: Motor de Asientos Contables Automáticos NIIF / Libro Diario / Partida Doble — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Dominio Core: Entidades `JournalEntry`, `JournalEntryLine`, enums `JournalEntrySource` (Manual, SalesInvoice, PurchaseInvoice, PurchaseSettlement, etc.) y `JournalEntryStatus` (Draft, Posted, Cancelled).
      * Invariante estricta de partida doble: $\sum \text{Debe} == \sum \text{Haber}$ validada en tiempo de compilación y ejecución (`ValidatePostingInvariants()`), impidiendo contabilizar asientos descuadrados.
      * Persistencia EF Core: Configuraciones mapeadas al esquema `accounting` (`accounting.journal_entries`, `accounting.journal_entry_lines`), migraciones aplicadas (`AddJournalEntriesAndLinesModule`), repositorio `IJournalEntryRepository` / `JournalEntryRepository` con secuenciador anual `AS-{year}-000001`.
      * CQRS en `EcuNexo.Business`:
        - `ListJournalEntriesQuery` con cálculo en memoria de KPIs (Total Asientos, Contabilizados, Borradores, Volumen Debe acumulado).
        - `GetJournalEntryByIdQuery` para detalle de asientos con líneas.
        - `CreateJournalEntryCommand` para creación de asientos manuales con validación de cuentas imputables activas.
        - `GeneratePurchaseJournalEntryCommand` para contabilización automática de facturas de compra y liquidaciones SRI (Tipo 03), asignando Inventario/Gasto, Crédito Tributario IVA (15%) y Pasivo de Proveedores Locales.
      * Endpoints REST V1 en `/api/v1/tenants/{tenantId}/accounting/journal-entries` con RBAC conforme a regex (`contabilidad.asientos.read`, `contabilidad.asientos.manage`).
      * Tests backend: 294 pruebas pasando al 100% (203 Core + 91 Business incluyendo DI y Handlers).
    - **Frontend (`ecunexo_admin`):**
      * Nueva Skill creada: [`.agents/skills/ui-vistas-sobre-modales/SKILL.md`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/ui-vistas-sobre-modales/SKILL.md) y Regla 9 en `GEMINI.md` priorizando páginas dedicadas sobre popups para formularios de 3+ campos o procesos operativos.
      * Vista de listado [`JournalEntriesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/JournalEntriesListPage.tsx): Conectada a la API real bajo `/contabilidad/asientos`, 4 StatCards en `.ecu-stat-grid`, filtros por estado/búsqueda y tabla responsive con verificación de cuadre.
      * Vista dedicada de creación [`JournalEntryCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/JournalEntryCreatePage.tsx): Página completa bajo `/contabilidad/asientos/nuevo` (sin modal), selector de cuentas auxiliares imputables, grilla dinámica de apuntes Debe/Haber y cálculo reactivo de cuadre en tiempo real.
      * Rutas enlazadas en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx).
      * Suite E2E Playwright: 6/6 tests pasando en `tests-ui/comun/contabilidad-ui.spec.ts` y 21/21 en `compras-ui.spec.ts`.
  - **Fase 1: Emisión y Registro de Liquidaciones de Compra SRI (Tipo 03) — Concluida con Testing 100%:**
    - **Backend (`ecunexo_api`):**
      * Generador algorítmico de Clave de Acceso SRI de 49 dígitos Módulo 11 (`SriAccessKeyGenerator.cs`).
      * Invariante legal estricta Art. 48 RCVR: Rechazo y validación bloqueante si el sujeto pasivo emisor posee RUC activo (error `purchases.settlement.supplier_has_ruc`). Solo autorizada para personas naturales sin RUC (Cédula) o extranjeros sin residencia.
      * Endpoints dedicados `GET` y `POST` en `/api/v1/tenants/{tenantId}/purchases/settlements` protegidos con permisos RBAC conformes a regex (`facturacion.liquidacion.compra.read`, `facturacion.liquidacion.compra.issue`, `purchases.documents.read`, `purchases.documents.manage`).
      * Filtrado de comprobantes por `documentType = "03"` en `IPurchaseRepository` y persistencia con clave de acceso autogenerada.
      * Cobertura de tests unitarios: 283 tests pasando al 100% (197 Core + 86 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista de emisión [`PurchaseSettlementCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementCreatePage.tsx): Formulario M3 con validación preventiva inmediata Art. 48 RCVR (banner de bloqueo si el proveedor tiene RUC y deshabilitación del botón emitir), desglose de ítems, cálculo reactivo de retención obligatoria del **100% de IVA** y porcentaje de Impuesto a la Renta (AIR 0%, 1%, 1.75%, 2%, 8%, 10%), y resumen económico con neto a desembolsar.
      * Vista de listado [`PurchaseSettlementsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementsListPage.tsx): Conectada a la API real con DataGrid de Glubox, 4 KPIs automáticos (Total, Autorizadas, Borrador, Monto Liquidado) y botón "Nueva Liquidación".
      * Registro de ruta `/compras/liquidaciones/nueva` en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx).
      * Suite E2E Playwright: 21 tests pasando al 100% en `tests-ui/comun/compras-ui.spec.ts`.
  - **Plan de Arquitectura Contable NIIF, Cierre Tributario SAS y Liquidaciones SRI Tipo 03:**
    - Elaboración del plan minucioso en 4 fases: Emisión de Liquidaciones (Tipo 03 SRI), Asientos Contables Automáticos (Libro Diario), Pre-declaración mensual F104/F103/ATS y Estados Financieros oficiales SCVS (P&G y Balance General).
    - Actualización del skill `.agents/skills/compras-ecuador-sri/SKILL.md` integrando normativa del Art. 48 RCVR, retención del 100% de IVA y sincronización con el catálogo NIIF.
  - **Refactor UI de Formularios y Modales en Contabilidad (`AccountModal.tsx`):**
    - Corrección de anomalías visuales en el modal de cuentas: eliminación de contenedores y estilos inline rígidos, integración de `.ecu-customer-form` y `.ecu-customer-form__grid`.
    - Estandarización de componentes Glubox (`TextBox`, `Select`) con `labelPosition="outlined"` y `variant="outline"`.
    - Eliminación de cajas toscas en checkboxes sustituyéndolas por `CheckButton` y `.ecu-customer-form__hint`.
    - Estandarización de acciones nativas del `<Popup>` con la prop `actions` y banner informativo para cuentas protegidas SCVS.
  - **Blindaje de Permisos RBAC y Estado de Firma SRI en Compras:**
    - Retiro de botones redundantes de configuración de firma en vistas operativas de Retenciones y Liquidaciones de Compra (`PurchaseWithholdingsListPage.tsx`, `PurchaseSettlementsListPage.tsx`), preservando la seguridad y segregación de funciones (la configuración de firma electrónica es potestad exclusiva de Ajustes de Empresa con permisos de rol de administración).
    - Eliminación completa de términos técnicos crudos `.p12` de la interfaz de emisión de facturas (`FacturaEmitirPage.tsx`).
    - Incorporación de insignias informativas de estado SRI y firma electrónica (`SRI Pruebas / SRI Producción` y `Firma Digital Activa / Sin Firma / Expirada`).
  - **Sincronización Criptográfica con Licenciamiento de Producción (license.ecunexo.com):**
    - Extracción de la clave pública oficial RSA-PSS SHA-256 desde el endpoint `GET /api/v1/platform/public-key` de la plataforma de licencias de producción.
    - Actualización en el backend del Cliente (`license-public.pem` y `appsettings.json` `LicenseValidation:SigningPublicKeyPem`) erradicando el error `license.artifact.signature` ("La firma de la licencia no es válida").
  - **Unificación Canónica del Módulo «Compras»:**
    - Normalización de denominaciones en `ModuleDependencyGraph.cs`, `MenuCatalogSeedData.cs` y `ModuleTierCatalog.cs`, consolidando «Compras, Gastos & Recepción SRI» bajo la denominación canónica «Compras».
    - Mantenimiento integral de los flujos de recepción de facturas electrónicas XML 01 y diferenciación de compras de inventario vs. gastos de servicios directos dentro del mismo módulo técnico `purchases`.
  - **Rediseño UI/UX de Ampliación de Licencia (`ApplyLicenseSection.tsx`):**
    - **Resolución de Asimetría Vertical y Dead Space:** Sustitución de la cuadrícula desequilibrada (input de 40px vs dropzone de 180px) por un flujo guiado en 2 columnas con numeración de pasos (`1` Código de activación, `2` Archivo de licencia).
    - **Tarjeta de Guía Criptográfica:** Inclusión de panel informativo con icono de clave y reglas de correspondencia obligatoria para equilibrar la columna izquierda.
    - **Previsualización Estructurada de Licencia Detectada:** Al cargar el archivo `.ecunexo-license`, se reemplazó el texto plano corrido por una tarjeta M3 con badge del plan (`Enterprise-plus`, etc.) y chips individuales (`.ecu-plan-page__chips`) formateados con nombres legibles (`moduleLabel`), suprimiendo el helperText plano de FileBox.
    - **Integración con `SectionCard`:** Unificación visual con el resto de `OrganizationPlanPage`, tipografía monoespaciada para el serial de activación, indicador de estado reactivo y botón `Actualizar Licencia` con icono `KeyRound`.
  - **Control de Ingreso a Bodega sin Factura & Blindaje Legal/Tributario del Proveedor:**
    - **Análisis Jurídico-Tributario (SRI Ecuador):**
      * Neutralidad de la herramienta informática: el proveedor SaaS no es sujeto pasivo tributario ni solidariamente responsable por las operaciones materiales de sus clientes (Código Orgánico Tributario, Arts. 24 a 28; LRTI y COIP Art. 298 sobre defraudación tributaria).
      * El software provee una herramienta estándar requerida para inventarios iniciales, mermas, ajustes de conteo y devoluciones sin comprobante SRI cruzado.
    - **Pilar 1: Trazabilidad Estricta & Kárdex Inmutable:**
      * Auditoría forense mediante `IAuditable` (`created_by`, `created_at`, `approved_by`, `approved_at`, `warehouse_id`, `receipt_origin` y `notes`), permitiendo delimitar exactamente qué usuario de la empresa dio de alta o aprobó cada lote físico.
    - **Pilar 2: Tipificación Transparente de Movimientos:**
      * `InventoryReceiptOrigin` diferencia explícitamente `Purchase` (factura SRI obligatoria validada con formato `001-001-000000123`) de `Opening`, `Return` y `Other` (movimientos internos sin crédito tributario).
    - **Pilar 3: Alerta Preventiva en UI (`CreateInventoryDocumentPage.tsx`):**
      * Inclusión de banner contextual `.ecu-info-banner` cuando el origen es interno (sin factura SRI), recordando que no genera crédito fiscal ni sustituye una factura SRI, y que la empresa es la única responsable del sustento documental.
    - **Pilar 4: Cláusula Contractual de Deslinde en Términos y Condiciones (`legalTermsContent.ts`):**
      * Adición formal de la Sección 8 ("Control de Inventarios, Bodegas y Movimientos de Stock sin Sustento Tributario") con declaración de no certificación de procedencia tributaria, exoneración total y retención de bitácoras de auditoría ante requerimientos judiciales.
  - **Plan General de Cuentas Contables NIIF / SCVS Ecuador & Sinergia con Compras:**
    - **Catálogo Oficial SCVS Ecuador (`StandardEcuadorChartOfAccounts`):**
      * Catálogo maestro estándar de 45 cuentas jerárquicas conforme al marco oficial de la Superintendencia de Compañías, Valores y Seguros del Ecuador (NIIF para PYMES).
      * Cuentas organizadas por grupos: 1. Activo (Caja, Bancos, Clientes, Inventarios/Kárdex, Crédito Tributario IVA Compras/AIR), 2. Pasivo (Proveedores Locales/Exterior, Anticipos Clientes, Retenciones por Pagar SRI, IESS), 3. Patrimonio (Capital Social, Reservas, Utilidad del Ejercicio), 4. Ingresos (Ventas 15%, Ventas 0%, Taller/Servicios) y 5. Costos y Gastos (Costo de Mercaderías Vendidas, Gastos de Personal, Arriendos, Servicios Básicos, Publicidad/Marketing, Fletes/Couriers, Comisiones).
    - **Dominio & Base de Datos:**
      * Entidad `Account` con `AccountType` (Asset, Liability, Equity, Revenue, Expense), `AccountNature` (Debit, Credit), cálculo de nivel jerárquico por código decimal, inferencia de cuenta padre y control de movimiento transaccional.
      * Migración EF Core `20260913212005_AddAccountingAccountsModule` en esquema `accounting`, tabla `accounts`, con índices por tenant, código único y tipo de cuenta.
      * Repositorio `IAccountRepository` en `EcuNexo.Data/Repositories/AccountRepository.cs`.
    - **CQRS Commands & Queries:**
      * `SeedStandardEcuadorPlanCommand`: Semillero seguro que inserta el catálogo oficial SCVS sin duplicar registros y enlazando las cuentas de mayor a sus auxiliares.
      * `ListAccountsQuery`, `CreateAccountCommand`, `UpdateAccountCommand`, `DeleteAccountCommand`.
      * Endpoints REST V1 en `/api/v1/tenants/{tenantId}/accounting/accounts` protegidos por permisos RBAC conformes a regex `^[a-z0-9]+(\.[a-z0-9]+)*$` (`contabilidad.plan.contable.read`, `contabilidad.plan.contable.manage`, `contabilidad.cuentas.read`, `contabilidad.cuentas.manage`).
    - **Frontend (Glubox & Material Design 3):**
      * Vista [`ChartOfAccountsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/ChartOfAccountsPage.tsx) con PageHeader, KPIs M3 dentro de `<div className="ecu-stat-grid">`, filtros por Grupo NIIF y cuentas imputables, DataGrid jerárquico con indentación por nivel, código monoespaciado y badges de naturaleza/imputabilidad.
      * Modal [`AccountModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/AccountModal.tsx) para crear y editar cuentas con inferencia reactiva de tipo y naturaleza según el primer dígito del código contable.
      * Rutas enlazadas en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx) para `/contabilidad/plan-contable` y `/contabilidad/cuentas`.
    - **Pruebas Automatizadas:**
      * 192 pruebas en `EcuNexo.Core.UnitTests` y 84 pruebas en `EcuNexo.Business.UnitTests` (276 tests backend al 100%).
      * 4 pruebas de UI en Playwright (`tests-ui/comun/contabilidad-ui.spec.ts`) y 18 pruebas en (`tests-ui/comun/compras-ui.spec.ts`) pasando al 100%.
  - **Optimización de Importación de Compras, Detección de Duplicados & Sinergia con Bodega:**
    - **Prevención de XMLs Duplicados (Backend & Frontend):**
      * Detección estricta de comprobantes repetidos en cola (por clave de autorización de 49 dígitos o combinación RUC proveedor + secuencial), omitiendo cargas redundantes con aviso claro al usuario.
      * Verificación bidireccional contra base de datos en `ParseSriPurchaseXmlHandler` y bloqueo contra duplicidad en `CreatePurchaseHandler` (`purchases.authorization_number.duplicate`).
      * Indicador visual en grilla con badge `Ya en Sistema`, deshabilitación de selección para importación masiva y alertas explicativas.
    - **Simplificación Visual y Eliminación de Información Redundante:**
      * Depuración de alertas en la auditoría preventiva SRI: eliminación de las 4 cajas repetitivas que duplicaban la información de las métricas KPI, reemplazándolas por un banner limpio de auditoría aprobada (`.ecu-audit-clean-banner`) y reservando las alertas exclusivamente para advertencias, contingencias o inconsistencias reales.
    - **Ocultamiento Condicional del Selector de Bodega y Sinergia con Bodega:**
      * Si la compra no maneja existencias (servicios o líneas sin stock), se oculta por completo el `<Select>` de bodega predeterminada para no generar confusión visual, adaptando el layout a 2 columnas.
      * En facturas con múltiples productos (bienes y gastos en el mismo comprobante), cada línea dispone de un selector individual para definir si es Mercadería (Stock) o Gasto Operativo Directo, con botones de asignación masiva rápida.
      * Sinergia total con almacén: los productos que no se homologan en el momento de la importación quedan marcados como `⏳ Pendiente Recepción en Bodega`, registrando la compra contablemente y habilitando su recepción física y kárdex en `ReceivePurchaseModal`.
    - **Columna de Acciones Fija (Sticky / Fixed):**
      * La columna de acciones en la tabla de cola (`.ecu-col-actions-header`, `.ecu-col-actions-cell`) y en la grilla principal de documentos (`ComprasDocumentosPage.tsx` con `sticky: 'right'`) queda permanentemente visible y anclada al desplazarse horizontalmente.
  - **Catálogo Oficial SRI AIR Tabla 3.10 ATS 2026 y Edición Completa de Conceptos (`/compras/categorias`):**
    - **Extracción Autorizada del SRI ATS:** Extracción e integración fiel de la "Tabla 3.10: CONCEPTOS DE RETENCIÓN EN LA FUENTE DE IMPUESTO A LA RENTA (AIR) DESDE 06/AGOSTO/2026" de `Catalogo_ATS.pdf` (creación de [`src/lib/sriAirCatalog.ts`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/lib/sriAirCatalog.ts) con códigos 300 para residentes y 500 para exterior).
    - **Corrección de Códigos Desfasados:** Reemplazo de tarifas erróneas (ej. código 332 corregido de 2% a 0% oficial para RIMPE Negocios Populares y no sujetos a retención; 344 normalizado al código ATS oficial de 4 dígitos `3440` al 3%; adición de `3482` al 5% para comisiones a sociedades, `304A`, `311`, `319`, `322`, `343A`, etc.).
    - **Edición Completa en [`ExpenseTypeModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypeModal.tsx):**
      * Selector categorizado con todas las opciones oficiales de la Tabla 3.10 y opción para código AIR manual.
      * Callout informativo dinámico con código oficial, grupo tributario, descripción íntegra del SRI y notas técnicas aplicables.
      * Botón "Copiar descripción oficial a nombre y notas" para sincronizar la categoría en 1 clic.
      * Flexibilidad total para editar porcentajes (0%, 1%, 1.75%, 2%, 3%, 5%, 10%, 15%, 25%, etc.), fechas de vigencia y sustentos.
      * Las categorías de sistema (`isSystem = true`) permiten modificar libremente todos sus campos tributarios (nombre, sustento, retención AIR, porcentaje, vigencia, notas y estado activo) bloqueando únicamente el código interno para preservar la integridad del ATS.
    - **Visualización Enriquecida en [`ExpenseTypesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypesListPage.tsx):** La columna "Retención AIR (IR)" ahora expone el código AIR, porcentaje con estilo condicional (0% en gris neutro, tarifas gravadas en azul primario) y la descripción oficial del concepto SRI como subtítulo y tooltip.
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
    - **Distinción de Bienes vs Servicios y Reestructuración en Dos Vistas de Importación:**
      * **Bienes vs Servicios:** Las categorías y comprobantes de servicios (fletes, encomiendas Servientrega, courier, arriendos, honorarios, etc.) no manejan stock ni requieren ingreso a bodega. Si la categoría tiene `affectsInventory = false`, el selector de bodega se inhabilita con aviso explicativo, el stock se fija en `Sin Stock (Servicio)` y la compra se registra directamente en estado `Invoiced` (Facturado) sin quedar bloqueada en bodega.
      * **UI Dividida en Dos Vistas:** La vista de importación `/compras/documentos/importar` se rediseñó en dos modos limpios:
        1. **Modo Cola/Grid Principal (`queue`):** Ancho completo con toolbar superior (+ Cargar más XMLs, Pegar XML, Factura Física, Vaciar Cola), KPI cards, DataGrid espacioso con clasificación Bien/Servicio y botón "Configurar / Auditar".
        2. **Modo Detalle/Auditoría (`detail`):** Vista de inspección profunda con botón destacado "← Volver a la Cola de Facturas", paginador rápido entre facturas del lote, auditoría SRI Módulo 11 y tabla completa de líneas.
      * **Detección Automática por Emisor:** Comprobantes de empresas de courier/encomiendas (Servientrega, Laar, Urbano, etc.) y telecomunicaciones/cloud se asignan automáticamente a su categoría de servicio correspondiente al cargar el XML.
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
