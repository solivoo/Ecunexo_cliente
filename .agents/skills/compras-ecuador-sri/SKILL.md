---
name: compras-ecuador-sri
description: >-
  Estándares técnicos, normativos y de arquitectura para el módulo de Compras y
  Retenciones Electrónicas SRI de Ecuador (ATS v2.0, Ficha Técnica v2.32, tipos de gastos y
  retenciones IR/IVA para e-commerce y empresas).
---

# Módulo de Compras & Retenciones SRI (Ecuador)

Este documento condensa los requisitos tributarios, normativos y de arquitectura de software para el registro de compras, control de gastos, emisión de comprobantes de retención electrónica (SRI Tipo 07) y liquidaciones de compra (SRI Tipo 03) conforme a la **Ficha Técnica SRI Esquema Offline v2.32 (Octubre 2025)** y el **Anexo Transaccional Simplificado (ATS)**.

---

## 1. Alcance y Arquitectura Funcional

El módulo de compras en EcuNexo se organiza en 4 pilares:
1. **Directorio de Proveedores (Maestro de Proveedores):**
   * Registro con RUC/Cédula, Razón Social, Nombre Comercial, tipo de contribuyente (Especial, RIMPE Emprendedor, RIMPE Negocio Popular, Régimen General), correo de recepción de retenciones y condiciones de crédito.
   * Gestión de proformas/cotizaciones vinculadas al proveedor para compras proyectadas.
2. **Ingreso y Sustentación de Facturas de Proveedores:**
   * **Lectura automática de XML (Tipo 01):** Parseo de la factura electrónica del proveedor por archivo o clave de acceso (49 dígitos), asociando bases imponibles, tarifa 15%, 5%, 0% y no objeto.
   * **Mapeo a Kárdex/Inventario:** Para ítems físicos de catálogo (`catalog_items`), generación directa de documento de inventario (Ingreso por Compra) actualizando costo ponderado y stock de ecommerce.
   * **Clasificación de Tipo de Gasto / Sustento Tributario:** Deducibilidad y categorización de costos operativos, mercadería o servicios.
3. **Emisión de Comprobantes de Retención (SRI 07 - Anexo 10 ATS v2.0.0):**
   * Validación automática si la empresa (Tenant) es **Agente de Retención** calificado o emite retención obligatoria.
   * Cálculo de bases y retenciones de Impuesto a la Renta (IR) e IVA según matrices del SRI.
   * Generación de XML, firma digital XAdES-BES (`.p12`), transmisión al web service SRI y generación de RIDE PDF.
4. **Liquidaciones de Compra de Bienes y Prestación de Servicios (SRI 03):**
   * Para compras a personas sin RUC autorizadas por ley (artesanos, mano de obra no profesional rural, etc.).

---

## 2. Tipos de Comprobantes de Compra (Catálogo ATS Tabla 4)

| Código | Descripción en SRI | Emisor / Flujo en EcuNexo |
| :--- | :--- | :--- |
| **01** | Factura | Emitida por el proveedor. EcuNexo la recibe, parsea (XML) y registra. |
| **03** | Liquidación de compra de bienes y prestación de servicios | Emitida por el comprador (EcuNexo) con firma y autorización SRI. |
| **04** | Nota de Crédito | Emitida por el proveedor para anular o descontar compras. |
| **05** | Nota de Débito | Emitida por el proveedor por intereses o recargos. |
| **07** | Comprobante de Retención | Emitido por el comprador (EcuNexo) cuando es Agente de Retención. |
| **41** | Comprobante de Venta emitido por Reembolso | Para gastos corporativos sujetos a reembolso. |

---

## 3. Tipos de Gasto y Sustentos Tributarios SRI (Tabla 5 ATS)

En Ecuador, cada factura de compra debe vincularse a un **Código de Sustento del Crédito Tributario** para la declaración de IVA (Formulario 104) y Renta (Formulario 103 / 101):

### Catálogo de Sustentos Tributarios (Códigos SRI)
1. **01 — Crédito Tributario para declaración de IVA:**
   * Compras de bienes y servicios directamente destinados a la producción o comercialización gravada con tarifa IVA (aplica 100% crédito tributario).
2. **02 — Costo o Gasto para declaración de Impuesto a la Renta:**
   * Adquisiciones que constituyen costo o gasto deducible pero sin derecho a crédito tributario total de IVA (ej. gastos administrativos generales, ventas tarifa 0%).
3. **03 — Activo Fijo:**
   * Maquinaria, equipos de cómputo, vehículos, muebles de oficina o servidores que se activan y deprecian en el tiempo.
4. **04 — Liquidación de Gastos de Viaje, Hospedaje y Alimentación:**
   * Viáticos y comisiones autorizadas del personal.
5. **06 — Adquisiciones no gravadas / Exentas de IVA:**
   * Medicamentos, servicios de transporte de carga, insumos básicos exentos.
6. **10 — Distribución de Dividendos:**
   * Pagos a socios y accionistas.

### Semillero (Seed) de Tipos de Gastos Operativos Recomendados
Para facilitar el uso al usuario no contador, EcuNexo clasifica las compras con un selector amigable mapeado al sustento SRI:
* **Mercadería para la Venta (Inventario / E-commerce):** Sustento `01`, afecta kárdex físico y costo de ventas.
* **Embalaje, Empaques y Envíos (Couriers):** Sustento `01`, gastos directos de distribución ecommerce.
* **Publicidad y Marketing Digital (Meta Ads, Google, Influencers):** Sustento `02`, servicios publicitarios.
* **Servicios Tecnológicos y Hosting (AWS, Cloud, Software SaaS):** Sustento `02` o pago exterior.
* **Arrendamiento de Locales / Bodegas:** Sustento `02`, sujeto a retención Código 320.
* **Honorarios Profesionales y Asesoría (Legal, Contable, TI):** Sustento `02`, sujeto a retención Código 303 / 3440.
* **Mantenimiento y Reparación de Instalaciones:** Sustento `02`, sujeto a retención Código 343.
* **Servicios Básicos (Luz, Agua, Telecomunicaciones, Internet):** Sustento `02`.
* **Suministros de Oficina y Limpieza:** Sustento `02`.
* **Activo Fijo / Equipamiento de Bodega:** Sustento `03`.

---

## 4. Estructura XML de Retención ATS (Ficha Técnica SRI Anexo 10 - v2.0.0)

El comprobante de retención electrónico emitido por EcuNexo (`version="2.0.0"`) requiere obligatoriamente:

```xml
<comprobanteRetencion id="comprobante" version="2.0.0">
  <infoTributaria>
    <ambiente>[1: Pruebas | 2: Producción]</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>RAZON SOCIAL DEL COMPRADOR</razonSocial>
    <nombreComercial>NOMBRE COMERCIAL</nombreComercial>
    <ruc>179XXXXXXXX001</ruc>
    <claveAcceso>49 DIGITOS NUMERICOS</claveAcceso>
    <codDoc>07</codDoc>
    <estab>001</estab>
    <ptoEmi>001</ptoEmi>
    <secuencial>000000001</secuencial>
    <dirMatriz>DIRECCION MATRIZ</dirMatriz>
    <!-- Si es Agente de Retención obligatorio -->
    <agenteRetencion>NAC-DNCRASC20-00000001</agenteRetencion>
  </infoTributaria>
  <infoCompRetencion>
    <fechaEmision>dd/mm/aaaa</fechaEmision>
    <dirEstablecimiento>DIRECCION SUCURSAL</dirEstablecimiento>
    <tipoIdentificacionSujetoRetenido>[04: RUC | 05: Cédula | 06: Pasaporte]</tipoIdentificacionSujetoRetenido>
    <razonSocialSujetoRetenido>RAZON SOCIAL PROVEEDOR</razonSocialSujetoRetenido>
    <identificacionSujetoRetenido>17XXXXXXXX001</identificacionSujetoRetenido>
    <periodoFiscal>MM/AAAA</periodoFiscal>
  </infoCompRetencion>
  <docsSustento>
    <docSustento>
      <codSustento>01</codSustento>
      <codDocSustento>01</codDocSustento>
      <numDocSustento>001001000000123</numDocSustento>
      <fechaEmisionDocSustento>dd/mm/aaaa</fechaEmisionDocSustento>
      <numAutDocSustento>NUMERO AUTORIZACION FACTURA PROVEEDOR</numAutDocSustento>
      <pagoLocExt>01</pagoLocExt>
      <totalSinImpuestos>1000.00</totalSinImpuestos>
      <importeTotal>1150.00</importeTotal>
      <impuestosDocSustento>
        <impuestoDocSustento>
          <codImpuestoDocSustento>2</codImpuestoDocSustento>
          <codigoPorcentaje>4</codigoPorcentaje> <!-- 4 = 15% IVA -->
          <baseImponible>1000.00</baseImponible>
          <tarifa>15.00</tarifa>
          <valorImpuesto>150.00</valorImpuesto>
        </impuestoDocSustento>
      </impuestosDocSustento>
      <retenciones>
        <!-- Retención Renta -->
        <retencion>
          <codigo>1</codigo> <!-- 1: Renta -->
          <codigoRetencion>312</codigoRetencion> <!-- 1.75% Bienes -->
          <baseImponible>1000.00</baseImponible>
          <porcentajeRetener>1.75</porcentajeRetener>
          <valorRetenido>17.50</valorRetenido>
        </retencion>
        <!-- Retención IVA -->
        <retencion>
          <codigo>2</codigo> <!-- 2: IVA -->
          <codigoRetencion>1</codigoRetencion> <!-- 1 = 30% IVA Bienes -->
          <baseImponible>150.00</baseImponible>
          <porcentajeRetener>30.00</porcentajeRetener>
          <valorRetenido>45.00</valorRetenido>
        </retencion>
      </retenciones>
      <pagos>
        <pago>
          <formaPago>20</formaPago> <!-- 20: Sistema Financiero -->
          <total>1087.50</total> <!-- 1150 - 17.50 - 45.00 -->
        </pago>
      </pagos>
    </docSustento>
  </docsSustento>
</comprobanteRetencion>
```

---

## 5. Códigos Comunes de Retención en la Fuente (SRI)

### Impuesto a la Renta (Código 1)
* **312 (1.75%):** Transferencia de bienes muebles de naturaleza corporal.
* **343 (2.75%):** Servicios de transporte privado y servicios donde prima la mano de obra.
* **304 (8.00%):** Servicios donde prima el intelecto no profesional y comisiones.
* **303 / 3440 (10.00%):** Honorarios profesionales y servicios de docencia.
* **320 (8.00%):** Arrendamiento de bienes inmuebles a personas naturales.
* **322 (10.00%):** Arrendamiento de bienes inmuebles a sociedades.
* **332 (0.00% o diferenciado):** Adquisiciones a sujetos RIMPE Negocio Popular (no retención IR).

### Impuesto al Valor Agregado IVA (Código 2)
* **Código 1 (30%):** Adquisición de bienes gravados con tarifa de IVA a personas naturales o sociedades.
* **Código 2 (70%):** Adquisición de servicios o derechos a personas naturales o sociedades.
* **Código 3 (100%):** Adquisición de servicios profesionales (personas naturales), liquidaciones de compra, o cuando el comprador es Sector Público / Exportador habitual.
* **Código 7 (0%):** Operaciones exentas o no sujetas a retención (RIMPE Negocio Popular, etc.).

---

## 6. Liquidaciones de Compra de Bienes y Servicios (SRI Tipo 03)

### Casos de Emisión Legal (Art. 48 RCVR)
La liquidación de compra es un comprobante de venta emitido por el propio **comprador**:
1. **Personas naturales sin RUC:**
   - Prestación de servicios eventuales por personas que por su nivel cultural o rusticidad no poseen RUC.
   - Adquisición de bienes a pequeños recolectores o productores agropecuarios informales.
2. **Servicios prestados por no residentes:**
   - Contratación de servicios de consultoría, asesoría o software a extranjeros sin establecimiento en Ecuador (importación de servicios).
3. **Invariante Crítica:**
   - **PROHIBIDO** emitir liquidación de compra a personas o sociedades que posean RUC activo en el SRI. En ese caso el proveedor está obligado por ley a entregar su propia factura.

### Retenciones Obligatorias en Liquidaciones
* **IVA:** Aplica obligatoriamente retención del **100% del IVA** generado (Código 3).
* **IR:** Aplica el porcentaje de retención en la fuente respectivo según la naturaleza del bien o servicio (1.75% bienes, 2.75% mano de obra, 10% servicios profesionales o pagos al exterior).

---

## 7. Sinergia Contable NIIF y Cierre Tributario para Sociedades S.A.S.

Para una empresa S.A.S. en Ecuador:
1. **Asiento Contable Automático de Compra:**
   - **Debe:** Cuenta de Gasto Operativo (5.2.*) o Inventario/Kárdex (1.1.04.01).
   - **Debe:** Crédito Tributario IVA Compras (1.1.05.01).
   - **Haber:** Retenciones en la Fuente por Pagar (2.1.04.02).
   - **Haber:** Retención IVA por Pagar (2.1.04.03).
   - **Haber:** Cuentas por Pagar Proveedores (2.1.01.01).
2. **Cruce Mensual de IVA (Pre-declaración Formulario 104):**
   $$\text{Impuesto Causado} = \text{IVA Ventas (2.1.04.01)} - \text{IVA Compras/Liquidaciones (1.1.05.01)}$$
   $$\text{Total a Pagar o Saldo a Favor} = \text{Impuesto Causado} - \text{Retenciones IVA Recibidas}$$
3. **Anexo Transaccional Simplificado (ATS XML v2.0):**
   - Agrupa compras del mes (facturas y liquidaciones), ventas del mes y retenciones emitidas/recibidas para carga mensual en el portal del SRI.
4. **Estados Financieros para Superintendencia de Compañías (SCVS):**
   - **P&G:** Ventas Netas (4.1) - Costo de Ventas (5.1) = Utilidad Bruta - Gastos Operativos (5.2) = Utilidad del Ejercicio.
   - **Balance General:** $\text{Activo (1)} = \text{Pasivo (2)} + \text{Patrimonio (3)}$.
