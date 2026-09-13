---
name: taller-reparaciones-lotes
description: >-
  Estándares de arquitectura, trazabilidad por número de serie, fases técnicas (Diagnóstico,
  Reparación, QC), custodia fotográfica S3/B2, actas de despacho QR y tarifario N1/N2/N3 en EcuNexo.
---

# Taller, Reparaciones & Lotes B2B (ADR-011)

Esta skill documenta la arquitectura del módulo de servicio técnico, reacondicionamiento masivo y taller corporativo para marcas como Whirlpool y retail B2B.

---

## 1. Arquitectura de Lotes y Equipos Individuales

* **Lote de Reparación (`RepairBatch`):** Agrupa decenas o cientos de equipos que ingresan bajo una misma guía de remisión o acta de entrega.
* **Equipo Individual (`RepairEquipment`):**
  * Trazabilidad unitaria por **Número de Serie** (único a nivel nacional/cliente).
  * Código de modelo, descripción, falla reportada y severidad técnica (`N1: Leve/Estético`, `N2: Componente/Medio`, `N3: Crítico/Tarjeta/Motor`).
* **Fases Técnicas Operativas:**
  1. `Recepción (Ingress)`: Check-in físico y registro fotográfico inicial.
  2. `Diagnóstico (Diagnostic)`: Evaluación de fallas y asignación de tarifa N1/N2/N3.
  3. `Reparación (Repair)`: Ejecución técnica, repuestos utilizados y notas de trabajo.
  4. `Control de Calidad (QC)`: Pruebas funcionales y aprobación para salida.
  5. `Listo para Despacho / Despachado`: Empaque y entrega.

---

## 2. Tarifario por Cliente & Facturación Automática

* Cada cliente corporativo posee un tarifario maestro acordado para reparaciones N1, N2 y N3.
* Al generar el despacho del lote:
  * Validación estricta: Bloqueo de salida para equipos sin tarifa asignada.
  * Agrupación automática en borrador de factura electrónica SRI utilizando los servicios de catálogo `REP-N1`, `REP-N2`, `REP-N3`.

---

## 3. Custodia Fotográfica en Object Storage (B2 / S3) & Actas Criptográficas QR

* **Evidencia Visual WebP:**
  * Fotografías por etapa técnica optimizadas a WebP (thumbnails y vistas detalladas en lightbox).
  * Arquitectura cero-blob en base de datos; referencias por clave de almacenamiento (`storage_key`).
* **Actas de Despacho con Firma Criptográfica:**
  * Generación de albarán PDF con hash SHA-256 inalterable y código QR de verificación pública instantánea para inspección en muelle o transporte de carga.
