# ADR-011 — Módulo de Reparaciones de Equipos por Lotes (Taller B2B) y Facturación de Servicios

**Estado:** Propuesta / En modelado  
**Fecha:** 2026-09-10  

## Contexto

EcuNexo requiere expandirse hacia la gestión operativa de **talleres de reparación masiva (B2B)**, donde clientes corporativos (ej. Whirlpool) envían lotes de electrodomésticos o equipos con daños por golpes (clasificados por niveles de gravedad). 

Requisitos particulares:
1. **Importación flexible por Excel:** Los lotes vienen descritos en hojas de cálculo con campos variables según el lote o cliente. Se requiere un generador dinámico de plantillas basado en esquemas JSONB.
2. **Portal B2B con aislamiento de datos:** El cliente corporativo (Whirlpool) debe contar con un usuario para monitorear el estado de sus equipos en tiempo real, sin acceso a información de otros clientes ni administración interna.
3. **Despachos parciales o totales:** Los equipos listos pueden entregarse por partes.
4. **Facturación de servicios:** Al despacharse equipos reparados, el sistema debe permitir facturar el servicio de reparación (ítem tipo `service` en el catálogo) sin impactar el stock físico como venta de producto.

---

## Decisión

### 1. Bounded Context `Repairs` (o `Workshop`)
- Mantener las entidades de reparación (`RepairBatch`, `RepairEquipment`, `RepairDispatch`, `RepairBatchTemplate`) en su propio bounded context desacoplado de `Inventory` y `Catalog`.
- Los equipos en reparación **no** son ítems propios del stock del taller; pertenecen al cliente externo.

### 2. Esquemas Dinámicos con JSONB y Generador de Plantillas Excel
- Cada plantilla (`RepairBatchTemplate`) almacena la configuración de columnas en `column_definitions` (`jsonb`).
- La API/frontend genera un archivo `.xlsx` estandarizado con validaciones nativas de celdas (listas desplegables para niveles de daño).
- Al importar, los campos estándar (`serial_number`, `model`, `brand`, `damage_level`) se mapean a columnas indexadas, y los campos adicionales se preservan en `custom_attributes` (`jsonb`).

### 3. Clasificación de Daños por Niveles
- Se define un enum de dominio `DamageLevel`:
  - `Level1`: Leve / Estético (desabollado menor, pulido, retoque).
  - `Level2`: Medio / Gabinete (reparación de chapa, bisagras, calibración).
  - `Level3`: Grave / Estructural y Funcional (alineación de chasis, cambio de cuba, motor).

### 4. Seguridad RBAC & ABAC para Clientes B2B
- Nuevo rol: `taller.cliente_b2b` con permiso `repairs.b2b_portal.view`.
- Regla ABAC obligatoria: Las consultas de lotes y equipos para usuarios con rol B2B se filtran siempre por `customer_id == user.assigned_customer_id`.

### 5. Liquidación y Facturación SRI
- La salida de equipos genera un `RepairDispatch`.
- Desde el despacho se emite la factura electrónica SRI seleccionando un ítem de catálogo con `item_kind = service` (ej. "Servicio de Reacondicionamiento Nivel 1/2/3"), garantizando total conformidad con el módulo de facturación existente.

### 6. Almacenamiento de Imágenes en Amazon S3 (Principio Cero-Blob)
- **Invariante:** Queda terminantemente prohibido almacenar binarios, blobs (`BYTEA`) o base64 en la base de datos PostgreSQL, así como guardar archivos en el sistema de archivos del servidor API.
- Todas las fotos de evidencia (daño inicial y certificación final) se gestionan directamente en **Amazon S3 Buckets**.
- El backend emite URLs prefirmadas (`Presigned URLs`) con tiempo de expiración corto para la subida directa desde el cliente y la lectura segura en el portal B2B.

### 7. Despachos con Acta Digital y Código QR de Verificación
- Cada despacho de equipos (`RepairDispatch`) genera un acta formal en PDF que incorpora un código QR único con hash criptográfico (`verification_hash`).
- Permite la validación instantánea y pública del despacho en garitas de seguridad, transportistas o auditores en destino sin requerir login en el sistema administrativo.
