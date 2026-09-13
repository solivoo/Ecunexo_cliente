---
name: facturacion-sri-ecuador
description: >-
  Estándares de comprobantes electrónicos SRI de Ecuador (Factura 01, Nota de Crédito 04,
  Liquidación 03, Retención 07), firma digital XAdES-BES .p12, clave de acceso de 49 dígitos
  y WebServices SOAP de Recepción y Autorización en línea / offline.
---

# Facturación & Comprobantes Electrónicos SRI (Ecuador)

Esta skill sintetiza las reglas tributarias y tecnológicas del motor de facturación electrónica de EcuNexo conforme a las fichas técnicas del Servicio de Rentas Internas (SRI).

---

## 1. Tipos de Comprobantes Electrónicos

* **Tipo 01 — Factura Electrónica:** Venta de bienes y prestación de servicios.
* **Tipo 04 — Nota de Crédito:** Modificación, anulación o descuento sobre factura autorizada.
* **Tipo 05 — Nota de Débito:** Intereses por mora o recargos.
* **Tipo 06 — Guía de Remisión:** Traslado sustentado de mercaderías.
* **Tipo 07 — Comprobante de Retención:** Emitido por agentes de retención al pagar compras.
* **Tipo 03 — Liquidación de Compra:** Compras a personas sin RUC autorizadas.

---

## 2. Clave de Acceso (49 Dígitos Numéricos)

Término obligatorio generado algorítmicamente antes del envío:
$$\text{Clave de Acceso} = \text{Fecha (8)} + \text{Tipo Comprobante (2)} + \text{RUC (13)} + \text{Ambiente (1)} + \text{Serie (6: Estab + PtoEmi)} + \text{Secuencial (9)} + \text{Código Numérico (8)} + \text{Tipo Emisión (1: Normal)} + \text{Dígito Verificador (1: Módulo 11)}$$

* **Algoritmo Módulo 11:** Factores ponderados `7, 6, 5, 4, 3, 2` de derecha a izquierda. Si residuo es 0 o 1, dígito verificador es 0 o 1.

---

## 3. Firma Digital XAdES-BES & Certificados PKCS#12 (`.p12`)

* **Estándar:** Firma electrónica XML Advanced Electronic Signatures (XAdES-BES).
* **Entidades Certificadoras Homologadas:** Banco Central del Ecuador, Security Data, ANF AC, Uanataca, Consejo de la Judicatura.
* **Protección:** Contraseña de la firma custodiada por Tenant; validación previa de fecha de caducidad del certificado para evitar rechazos del SRI.

---

## 4. Web Services SRI (Esquema Offline)

1. **Servicio de Recepción:**
   * Endpoint SOAP recibe el XML firmado codificado en Base64.
   * Valida estructura XSD y vigencia de la firma. Retorna `RECIBIDA` o `DEVUELTA` con lista de errores.
2. **Servicio de Autorización:**
   * Consulta el estado del comprobante mediante la Clave de Acceso de 49 dígitos.
   * Retorna `AUTORIZADO` con número y fecha de autorización, o `NO AUTORIZADO` con causas de rechazo.
3. **Representación Impresa (RIDE PDF):**
   * Generación de PDF oficial con código de barras Code128 de 49 dígitos, desglose de impuestos (15%, 5%, 0%), información adicional (correo, dirección, forma de pago) y leyenda legal del emisor (ej. `Obligado a llevar contabilidad`, `Régimen RIMPE`, `Agente de Retención Resolución Nro...`).
