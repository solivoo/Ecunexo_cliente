# Planes, Precios y Matriz de Cumplimiento: Sector Transporte Ecuador

> **Fecha de Elaboración:** Septiembre 2026  
> **Ámbito:** Plataforma EcuNexo — Planes Comerciales, Precios de Mercado y Auditoría de Cumplimiento Funcional.

---

## 1. Contexto Operativo y Tributario del Sector Transporte en Ecuador

En el Ecuador, las empresas de transporte (carga pesada, carga liviana, logística, fletes interprovinciales o paquetería/encomiendas) están reguladas simultáneamente por el **Servicio de Rentas Internas (SRI)**, la **Agencia Nacional de Tránsito (ANT)** y la **Superintendencia de Compañías (SCVS)**.

### Requerimientos Críticos de Operación:
1. **Emisión de Guías de Remisión Electrónicas (SRI Tipo 06):**
   - Es el documento tributario obligatorio para circular en carretera amparando el traslado de mercaderías.
   - Contiene: RUC/Cédula y Razón Social del transportista, placa del vehículo, punto de partida, punto de llegada, ruta, fechas de inicio y fin del traslado, motivo del traslado y códigos de comprobantes de venta que sustentan la carga.
2. **Facturación de Servicios de Flete / Transporte (SRI Tipo 01):**
   - El servicio de transporte de carga y pasajeros goza de tarifa **0% de IVA** según el Art. 56 numeral 1 de la Ley de Régimen Tributario Interno (LRTI).
3. **Control Exhaustivo de Compras y Combustible:**
   - El 50% al 70% del costo operativo es **diésel/gasolina**, peajes, lubricantes, llantas y mantenimiento mecánico. Requiere recepción de facturas electrónicas XML de gasolineras con sustento tributario ATS.
4. **Obligación Contable (S.A.S. o Cía. Ltda.):**
   - Las empresas de transporte se constituyen principalmente como S.A.S. o Cías. Ltda., lo que exige contabilidad completa bajo NIIF para PYMES, pre-declaración mensual de impuestos (F104/F103) y balances a la SCVS.

---

## 2. Matriz de Planes y Precios Oficiales (Mercado Ecuador)

Los precios de EcuNexo se basan en el modelo de suscripción anual con un **15% de descuento por pago anticipado**:

| Concepto | Plan Básico Transporte (`local-comercio`) | Plan Flota Transporte (`empresa-pyme`) |
| :--- | :--- | :--- |
| **Segmento Objetivo** | 1 a 5 vehículos / furgones / camiones (Dueño + Despachador + Facturación) | 5 a 15 camiones (Flota mediana, choferes con acceso, oficinas en varias ciudades) |
| **Empresas (RUCs)** | 1 RUC | 1 RUC |
| **Usuarios Incluidos** | Hasta 3 usuarios concurrentes | Hasta 10 usuarios concurrentes |
| **Bodegas / Patios** | 1 patio de maniobras / punto de despacho | Hasta 3 terminales / bodegas (ej: Quito, Guayaquil, Cuenca) |
| **Precio Mensual** | $42 USD / mes | $79 USD / mes |
| **Precio Anual (−15% Descuento)** | **$428 USD / año** + IVA *(~$35,66 USD/mes)* | **$806 USD / año** + IVA *(~$67,16 USD/mes)* |
| **Módulos Incluidos** | `identity`, `facturacion`, `customers`, `purchases` (Tier Med), `contabilidad` (Tier Sml), `warehousing` (1), `inventory`. | Todos los anteriores + `purchases` (Tier Big), `contabilidad` (Tier Big), `warehousing` (3). |

---

## 3. Comparativa de Mercado en Ecuador

| Tipo de Solución en Ecuador | Rango Anual | Diagnóstico vs. EcuNexo ($428 / año) |
| :--- | :--- | :--- |
| **Facturadores Web Simples** *(Contifico, Dora, Facturero Móvil)* | $200 – $360 / año | Son económicos para emitir facturas simples, pero **cobran recargos por Guías de Remisión**, no tienen control de compras de combustible con importación XML, ni ofrecen conciliación contable SAS. |
| **TMS Dedicados de Transporte** *(Sistemas pesados de flotas)* | $900 – $1.800 / año | Tienen costos prohibitivos para una micro o pequeña transportista, cobran por camión registrado y exigen implementaciones iniciales de $500 a $1.500. |
| **EcuNexo Plan Local** | **$428 / año** | **Punto óptimo:** Cubre facturación de fletes, clientes, compras de combustible, contabilidad y bodegas a un precio plano y predecible sin costo por vehículo. |

---

## 4. Auditoría de Cumplimiento: ¿Cumplimos hoy con el Plan Básico de Transporte?

Evaluación técnica del estado actual de los módulos en el repositorio (`ecunexo_api` y `ecunexo_admin`):

| Módulo Requerido | Estado Actual | Detalle del Cumplimiento | Brecha Pendiente |
| :--- | :---: | :--- | :--- |
| **`identity` (Usuarios & Roles)** | **100% CUMPLIDO** | Gestión de choferes, operadores de tráfico, administradores con RBAC estricto multitenant. | Ninguna. |
| **`customers` (Clientes & Contactos)** | **100% CUMPLIDO** | Directorio de clientes remitentes y destinatarios, validación de RUC Sociedades (Módulo 11), Cédula (Módulo 10) y Pasaporte. | Ninguna. |
| **`facturacion` (Facturas Flete 01)** | **100% CUMPLIDO** | Emisión de facturas por servicios de flete (tarifa 0% y 15%), firma digital `.p12` XAdES-BES, transmisión SOAP SRI, generación de RIDE PDF y ambientes Pruebas/Producción. | Ninguna. |
| **`purchases` (Combustible & Gastos)** | **100% CUMPLIDO** | Importación y parseo de XMLs de gasolineras (diésel/gasolina) y mecánicas, detección de duplicados, liquidaciones de compra 03 y retenciones SRI. | Ninguna. |
| **`contabilidad` (NIIF & Balances)** | **100% CUMPLIDO** | Asientos contables automáticos, libro diario de partida doble, pre-declaración F104/F103 mensual y estados financieros (Balance General y P&G). | Ninguna. |
| **`warehousing` & `inventory`** | **100% CUMPLIDO** | Control de patio de maniobras, kárdex de repuestos propios (llantas/filtros) y deslinde legal tributario. | Ninguna. |
| **`facturacion` (Guía de Remisión 06)** | **PENDIENTE (80%)** | El parser XML del backend (`SriPurchaseXmlParser`) reconoce comprobantes `<guiaRemision>`, pero la **emisión propia de Guías de Remisión (Tipo 06)** figura en `sriDocumentTypes.ts` como `available: false; emitPath: null`. | **Falta la vista de emisión y el servicio de generación de Guía de Remisión (SRI Tipo 06).** |

---

## 5. Dictamen y Conclusión

* **Cumplimiento General del Plan Básico:** **~90%**.
* La empresa de transporte ya puede:
  1. Emitir sus facturas de flete autorizadas por el SRI.
  2. Registrar y auditar todas sus compras de combustible, llantas y talleres.
  3. Administrar su cartera de clientes remitentes y destinatarios.
  4. Generar su contabilidad completa, pre-declaración mensual F104/F103 y balances anuales a la Superintendencia de Compañías.
* **Única Funcionalidad Pendiente:** El formulario y flujo de emisión nativo de la **Guía de Remisión Electrónica (SRI Tipo 06)** (placa de vehículo, chofer, ruta y fecha traslado).
