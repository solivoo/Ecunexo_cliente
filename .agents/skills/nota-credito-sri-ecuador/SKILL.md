---
name: nota-credito-sri-ecuador
description: >-
  Estándares técnicos, normativos del SRI (Ficha Técnica v2.32) y de arquitectura de software para el
  módulo de Notas de Crédito Electrónicas (Comprobante 04, Esquema Offline v1.0.0 y v1.1.0) en Ecuador.
  Cubre vinculación con documentos de sustento (Factura 01, Liquidación 03), reglas de IVA vigentes por
  fecha de sustento, Clave de Acceso Módulo 11, precisión decimal (2 a 6 decimales), retorno de inventarios
  en Kárdex, afectación a Cuentas por Cobrar (A/R) y matriz de validaciones SRI.
---

# Nota de Crédito Electrónica SRI Ecuador (Comprobante 04)

Esta skill sintetiza las reglas tributarias, normativas (Ficha Técnica del SRI Esquema Offline Versión 2.32) y de arquitectura de software de EcuNexo para la generación, firma XAdES-BES, emisión, autorización y contabilización de **Notas de Crédito Electrónicas (Tipo 04)**.

---

## 1. Alcance y Propósito de la Nota de Crédito (Tipo 04)

La Nota de Crédito es el documento complementario emitido obligatoriamente por el vendedor para:
1. **Anulación total o parcial** de un comprobante de venta previamente emitido y autorizado (`codDocModificado` = `01` Factura, `03` Liquidación de Compra, etc.).
2. **Devolución de mercaderías** (afecta inventario físico en Kárdex y cartera del cliente).
3. **Descuentos o bonificaciones concedidos a posteriori** de la emisión del comprobante sustento (no afecta inventario físico, reduce valor por cobrar).
4. **Rescisión de contratos o corrección de precios** negociados a la baja.

> [!IMPORTANT]
> Una Nota de Crédito **NUNCA** se emite de forma aislada. Requiere de manera estricta la referencia explícita a un comprobante de venta autorizado de sustento (`codDocModificado`, `numDocModificado` y `fechaEmisionDocSustento`).

---

## 2. Clave de Acceso (49 Dígitos Numéricos)

La Nota de Crédito debe incluir una Clave de Acceso de 49 dígitos generada algorítmicamente antes del envío al WS del SRI:

$$\text{ClaveAcceso} = \text{FechaEmisión (8)} + \text{TipoComprobante (04)} + \text{RUC (13)} + \text{Ambiente (1)} + \text{Establecimiento (3)} + \text{PuntoEmisión (3)} + \text{Secuencial (9)} + \text{CódigoNumérico (8)} + \text{TipoEmisión (1)} + \text{DV (1)}$$

* **Algoritmo Módulo 11:**
  - Ponderación cíclica de derecha a izquierda: `7, 6, 5, 4, 3, 2`.
  - Residuos especiales: Si $\text{Residuo} = 0 \implies \text{DV} = 0$; si $\text{Residuo} = 1 \implies \text{DV} = 1$; en otros casos $\text{DV} = 11 - \text{Residuo}$.

---

## 3. Estructura Estándar del XML (Esquema Offline)

El XML de la Nota de Crédito consta de cuatro bloques jerárquicos principales:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>RAZÓN SOCIAL EMISOR S.A.</razonSocial>
    <nombreComercial>NOMBRE COMERCIAL</nombreComercial>
    <ruc>1792146739001</ruc>
    <claveAcceso>2110202604179214673900120010010000000011234567812</claveAcceso>
    <codDoc>04</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000001</secuencial>
    <dirMatriz>AV. PRINCIPAL 123 Y CALLE SECUNDARIA</dirMatriz>
    <!-- Etiquetas opcionales de régimen -->
    <regimenRimpe>CONTRIBUYENTE RÉGIMEN RIMPE</regimenRimpe>
    <agenteRetencion>1</agenteRetencion>
  </infoTributaria>

  <infoNotaCredito>
    <fechaEmision>21/10/2026</fechaEmision>
    <dirEstablecimiento>CALLE COMERCIAL 456</dirEstablecimiento>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>CLIENTE EJEMPLO S.A.</razonSocialComprador>
    <identificacionComprador>1713328506001</identificacionComprador>
    <contribuyenteEspecial>5368</contribuyenteEspecial>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <codDocModificado>01</codDocModificado>
    <numDocModificado>001-001-000000123</numDocModificado>
    <fechaEmisionDocSustento>15/10/2026</fechaEmisionDocSustento>
    <totalSinImpuestos>100.00</totalSinImpuestos>
    <valorModificacion>115.00</valorModificacion>
    <moneda>DOLAR</moneda>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>100.00</baseImponible>
        <valor>15.00</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <motivo>DEVOLUCIÓN PARCIAL DE MERCADERÍA DENTRO DEL PLAZO</motivo>
  </infoNotaCredito>

  <detalles>
    <detalle>
      <codigoInterno>PROD-001</codigoInterno>
      <codigoAdicional>SKU-99</codigoAdicional>
      <descripcion>PRODUCTO DE MUESTRA V1</descripcion>
      <cantidad>2.000000</cantidad>
      <precioUnitario>50.000000</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
      <detallesAdicionales>
        <detAdicional nombre="Lote" valor="L2026-09"/>
      </detallesAdicionales>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>4</codigoPorcentaje>
          <tarifa>15.00</tarifa>
          <baseImponible>100.00</baseImponible>
          <valor>15.00</valor>
        </impuesto>
      </impuestos>
    </detalle>
  </detalles>

  <infoAdicional>
    <campoAdicional nombre="E-MAIL">cliente@ejemplo.com</campoAdicional>
    <campoAdicional nombre="Observacion">Devolución aprobada por control de calidad</campoAdicional>
  </infoAdicional>
</notaCredito>
```

---

## 4. Reglas Tributarias & Validaciones SRI Críticas (Ficha Técnica v2.32)

### A. Regla de IVA según Fecha del Documento Sustento
> [!CAUTION]
> **REGLA DE ORO DE IVA EN NOTAS DE CRÉDITO:**
> La tarifa de IVA (`codigoPorcentaje` / `tarifa`) aplicada en la Nota de Crédito **DEBE ser exactamente la tarifa que estuvo vigente en la fecha de emisión del documento de sustento** (`fechaEmisionDocSustento`).
> 
> *Ejemplo:* Si una factura se emitió el 10 de Marzo con IVA 13% (`codigoPorcentaje` = 10) y la Nota de Crédito se emite en Mayo cuando el IVA es 15% (`codigoPorcentaje` = 4), la Nota de Crédito DEBE usar `codigoPorcentaje` = 10 (13%). Usar la tarifa actual del día de la NC causará el rechazo automático del SRI (Error 45).

### B. Catálogo de Tarifas de IVA (Tabla 17 del SRI)
| Código Porcentaje | Descripción | Tarifa (%) |
| :---: | :--- | :---: |
| `0` | 0% | 0.00 |
| `2` | 12% | 12.00 |
| `3` | 14% | 14.00 |
| `4` | 15% (Tarifa General Vigente) | 15.00 |
| `5` | 5% (Materiales de Construcción) | 5.00 |
| `6` | No Objeto de Impuesto | 0.00 |
| `7` | Exento de IVA | 0.00 |
| `8` | IVA Diferenciado | Variable |
| `10` | 13% (Tarifa Temporal 2024) | 13.00 |

### C. Catálogo de Identificación del Comprador (Tabla 6)
| Código | Tipo Identificación | Validación |
| :---: | :--- | :--- |
| `04` | RUC | 13 dígitos numéricos; algoritmo RUC de persona natural, sociedad privada o pública. |
| `05` | Cédula | 10 dígitos numéricos; algoritmo módulo 10 de provincias 01 a 24 o 30. |
| `06` | Pasaporte | Alfanumérico, máximo 20 caracteres. |
| `07` | Consumidor Final | Cadena exacta `9999999999999` (13 nueves). Restringido por monto legal. |
| `08` | Identificación del Exterior | Alfanumérico, máximo 20 caracteres. |

### D. Validación de Monto (`valorModificacion`)
* $\text{valorModificacion} = \text{totalSinImpuestos} + \sum (\text{impuestos}) - \text{compensaciones}$
* **Invariante:** `valorModificacion` **NO PUEDE superar el total con impuestos ni el saldo disponible** del documento modificado. Si supera el saldo pendiente de la factura, el SRI rechazará con Error 43.

### E. Formato de Documento Modificado (`numDocModificado`)
* Debe tener exactamente 15 caracteres con el patrón de máscara `XXX-XXX-XXXXXXXXX` (Establecimiento de 3 dígitos, guion, Punto de Emisión de 3 dígitos, guion, Secuencial de 9 dígitos).

---

## 5. Diferencias de Versión XML: v1.0.0 vs v1.1.0 (Anexo 3)

| Característica | Versión 1.0.0 | Versión 1.1.0 (Anexo 3 - Vigente) |
| :--- | :--- | :--- |
| **Decimales en `cantidad`** | Exactamente 2 decimales. | Entre 2 y 6 decimales (ej. `1.234567`). |
| **Decimales en `precioUnitario`** | Exactamente 2 decimales. | Entre 2 y 6 decimales (ej. `0.012345`). |
| **Campos Monetarios Totales** | 2 decimales estrictos. | 2 decimales estrictos (`precioTotalSinImpuesto`, `descuento`, `baseImponible`, `valor`, `totalSinImpuestos`, `valorModificacion`). |
| **Reembolsos / Reembolso de Gastos** | No soportado en infoNotaCredito. | Estructuras estandarizadas si el sustento fue liquidación o factura con reembolso. |

---

## 6. Lógica de Negocio en EcuNexo (Kárdex, A/R y Contabilidad)

Al autorizarse exitosamente una Nota de Crédito en el SRI, el backend de EcuNexo debe ejecutar atómicamente las siguientes operaciones:

### A. Dominio de Inventarios (Kárdex)
1. **Si el motivo implica Devolución de Mercadería:**
   - Registrar movimiento de **Entrada por Devolución de Cliente** en la bodega seleccionada.
   - Incrementar stock físico disponible de los ítems devueltos.
   - Recalcular el **Costo Promedio Ponderado (CPP)** del inventario:
     $$\text{Nuevo CPP} = \frac{(\text{Stock Previo} \times \text{CPP Previo}) + (\text{Cantidad Devuelta} \times \text{Costo Unitario Devolución})}{\text{Stock Previo} + \text{Cantidad Devuelta}}$$
2. **Si el motivo es Descuento / Ajuste de Precio / Corrección:**
   - No generar movimiento físico de stock (Cantidad = 0 en Kárdex).

### B. Dominio Cuentas por Cobrar (A/R)
1. Reducir la deuda o saldo vencido/por vencer de la Factura de origen.
2. Si el saldo de la Factura queda en $0.00, cambiar el estado de la factura a `PAGADA` / `ANULADA_POR_NC`.
3. Si la Nota de Crédito supera el saldo pendiente de la Factura (ej. la factura ya fue cobrada previamente), registrar el saldo a favor como **Crédito a Favor del Cliente / Anticipo** para cruzarse en futuras compras.

### C. Contabilización Automática (Asiento Contable)
- **Débito:** Ventas / Devoluciones en Ventas.
- **Débito:** IVA Ventas (Impuesto generado a revertir).
- **Crédito:** Cuentas por Cobrar Clientes (Disminución de cartera).
- **Débito (Si hay devolución de stock):** Inventario de Mercaderías (Activo).
- **Crédito (Si hay devolución de stock):** Costo de Ventas (Egreso).

---

## 7. Matriz de Errores Comunes SRI y Mitigación

| Código Error SRI | Causa Principal | Solución Automática en EcuNexo |
| :---: | :--- | :--- |
| **35** | `DOCUMENTO MODIFICADO NO EXISTE O NO AUTORIZADO` | Verificar que la factura original esté en estado `AUTORIZADO` en SRI antes de emitir la NC. |
| **43** | `VALOR DE MODIFICACIÓN SUPERA SALDO DEL SUSTENTO` | Validar en backend el acumulado de NCs previas emitidas a la misma factura para evitar sobredescuentos. |
| **45** | `TARIFA DE IVA NO CORRESPONDE A FECHA DE SUSTENTO` | Heredar automáticamente el `codigoPorcentaje` del detalle de la factura original según `fechaEmisionDocSustento`. |
| **50** | `FIRMA ELECTRÓNICA INVÁLIDA O CADUCADA` | Validar la vigencia del certificado `.p12` antes de encriptar el XML XAdES-BES. |
| **70** | `ERROR DE ESQUEMA XSD (TAGS O FORMATO)` | Validar el XML contra el archivo XSD `notaCredito_V1.1.0.xsd` previo a invocar el WebService SOAP. |

---

## 8. Check-list de Desarrollo & QA (Testing Obligatorio)

Al crear o modificar componentes o endpoints del módulo de Nota de Crédito:
- [ ] **Test Unitario (Core):** Verificación de generación de Clave de Acceso de 49 dígitos con Módulo 11 para `codDoc = 04`.
- [ ] **Test Unitario (Business):** Verificación de asignación de tarifa de IVA según la fecha de sustento (ej. factura de fecha con IVA 13% vs NC emitida hoy).
- [ ] **Test de Invariantes (Validation):** Impedir la emisión de NC con `valorModificacion` mayor al total de la factura de sustento.
- [ ] **Test de UI (Frontend):** Formulario dedicado en `/facturacion/notas-credito/nueva` (siguiendo skill `ui-vistas-sobre-modales`), con búsqueda de factura sustento, selección de detalles a devolver y desglose claro de subtotales por tarifa de IVA.
- [ ] **Test de Kárdex:** Comprobar que el ingreso a bodega solo se dispara si la NC es de tipo "Devolución de productos".
