---
name: proveedores-proformas
description: >-
  Estándares de arquitectura y experiencia de usuario para el Directorio de Proveedores
  y Gestión de Proformas / Cotizaciones de compra en EcuNexo (SRI, condición fiscal,
  términos de pago y flujo a orden de compra).
---

# Directorio de Proveedores & Proformas

Esta guía define las especificaciones para el maestro de proveedores y la anexión de proformas/cotizaciones comerciales en EcuNexo.

---

## 1. Ubicación y Navegación en la Arquitectura de EcuNexo

Para mantener la coherencia del sistema enterprise:
* **Ruta de Proveedores:** `/compras/proveedores` (o submódulo dentro de `Compras` en el Sidebar: `Compras → Proveedores`, `Compras → Facturas`, `Compras → Retenciones`, `Compras → Proformas`).
* **Permisos RBAC:** `suppliers.read`, `suppliers.manage` (análogo a `customers.read` y `customers.manage`).
* **Diseño UI:** Sigue el estándar `glubox-enterprise-ui` (PageHeader → StatCards → SectionCard → DataGrid con filtros y barra de búsqueda).

---

## 2. Entidad Proveedor (Supplier) & Validación SRI

Un proveedor en Ecuador debe almacenar datos comerciales y parámetros fiscales indispensables para emitirle retenciones válidas:

1. **Identificación y Datos Legales:**
   * Tipo de Identificación: `RUC (04)`, `Cédula (05)`, `Pasaporte (06)`.
   * Número de identificación con validación algorítmica:
     * Cédula: Algoritmo Módulo 10.
     * RUC Persona Natural: 10 dígitos + 001.
     * RUC Sociedad Privada: Algoritmo Módulo 11 (tercer dígito = 9) + 001.
     * RUC Entidad Pública: Algoritmo Módulo 11 (tercer dígito = 6) + 0001.
   * Razón Social y Nombre Comercial.
2. **Clasificación Fiscal SRI (Determinante para Retenciones):**
   * **Régimen Tributario:**
     * `Régimen General` (sociedad o persona natural obligada/no obligada).
     * `RIMPE Emprendedor` (sujeto a retención diferenciada de Renta 1% o 2%).
     * `RIMPE Negocio Popular` (emite Nota de Venta, no se retiene IVA ni Renta).
     * `Contribuyente Especial` (resolución número...).
     * `Agente de Retención` (resolución número...).
3. **Datos de Contacto y Operación:**
   * Correo Electrónico Principal (donde se despachará el RIDE y XML de la retención).
   * Teléfono y Dirección fiscal / matriz.
   * Condiciones de Crédito: Días de crédito (`0 = Contado`, `15, 30, 60, 90 días`), cupo máximo de crédito.
   * Cuenta Bancaria para transferencias: Banco, Tipo de Cuenta (Ahorros/Corriente), Número de Cuenta.

---

## 3. Gestión de Proformas / Cotizaciones de Proveedores

Para negocios comerciales y e-commerce, antes de emitir una orden de compra o recibir la factura, los proveedores envían **proformas**:

1. **Anexión y Registro de Proformas:**
   * Número o código de proforma del proveedor.
   * Proveedor seleccionado del maestro.
   * Fecha de emisión y fecha de vigencia / caducidad de precios.
   * Moneda y detalle de ítems (vinculados al catálogo de ítems o texto libre con costo cotizado).
   * Archivo adjunto: Carga de PDF/imagen de la cotización recibida en Backblaze B2 / S3 con vista previa.
2. **Estados de la Proforma:**
   * `Borrador / Recibida`: En evaluación técnica o comercial.
   * `Aprobada`: Autorizada por gerencia o compras para ejecución.
   * `Convertida a Compra`: Genera automáticamente la orden de compra o el borrador de factura de compra.
   * `Rechazada / Vencida`: Descartada o expirada.
3. **Flujo de Conversión a Factura de Compra:**
   * Al recibir la factura real del proveedor, el usuario puede seleccionar «Convertir proforma en compra» precargando ítems, cantidades y precios acordados para conciliar diferencias.
