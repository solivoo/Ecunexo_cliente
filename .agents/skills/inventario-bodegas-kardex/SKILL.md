---
name: inventario-bodegas-kardex
description: >-
  Estándares de arquitectura de software, trazabilidad física y kárdex contable
  promedio ponderado para bodegas, inventario, documentos de stock y traspasos en EcuNexo.
---

# Inventario, Bodegas & Kárdex Valorado (ADR-009 & ADR-010)

Esta skill documenta la arquitectura central del dominio de Inventario y Almacenamiento en EcuNexo, asegurando la separación estricta entre **Catálogo comercial** e **Inventario físico**.

---

## 1. Principios de Dominio & Separación (ADR-009)

* **Catálogo (`catalog_items`):** Definición comercial abstracta (SKU, Nombre, Tipo: Físico/Servicio, Precio Base, Categoría, Imágenes WebP). No posee cantidades ni ubicación de stock.
* **Inventario (`inventory_items`, `stock_balances`):** Existencia física real por bodega (`warehouse_id`), cantidad disponible, reservada (para e-commerce/reparaciones) y costo promedio ponderado.
* **Separación de Servicios:** Los ítems de tipo `Servicio` nunca generan balances ni kárdex en inventario.

---

## 2. Bodegas & Ubicaciones Físicas (`warehousing`)

* **Bodega (`Warehouse`):**
  * Entidad raíz con código, nombre, dirección, responsable y estado (`Activa`/`Inactiva`).
  * Puede ser designada como bodega principal, bodega de cuarentena o bodega de despacho ecommerce.
* **Saldos de Stock (`StockBalance`):**
  * Clave compuesta: `(tenant_id, warehouse_id, catalog_item_id)`.
  * Métricas atómicas:
    * `QuantityOnHand`: Stock físico total en estantería.
    * `QuantityReserved`: Stock comprometido en pedidos ecommerce o reparaciones en proceso (no disponible para nueva venta).
    * `QuantityAvailable`: `QuantityOnHand - QuantityReserved`.

---

## 3. Documentos de Inventario (`inventory_documents` - ADR-010)

Todas las alteraciones de stock y kárdex ocurren mediante documentos auditables inalterables:
1. **Tipos de Documento:**
   * `Ingreso (Ingress)`: Entrada de stock por compras a proveedores, producción o ajuste positivo.
   * `Egreso (Egress)`: Salida de stock por ventas/facturación, bajas por daño o ajuste negativo.
   * `Traspaso (Transfer)`: Movimiento entre bodegas con estados `Borrador` → `En Tránsito` → `Recibido`.
   * `Ajuste (Adjustment)`: Regularización tras toma física de inventario.
2. **Ciclo de Vida Inmutable:**
   * Los documentos en estado `Asentado (Posted)` nunca se eliminan ni editan; para corregir se emite una contrapartida auditada.

---

## 4. Kárdex Valorado (Costo Promedio Ponderado)

Cada movimiento asienta un registro en el kárdex con:
$$\text{Nuevo Costo Ponderado} = \frac{(\text{Stock Anterior} \times \text{Costo Anterior}) + (\text{Cantidad Ingresada} \times \text{Costo Unitario Compra})}{\text{Stock Total Resultante}}$$
* Las salidas se liquidan siempre al costo promedio vigente al momento de la transacción.
* Permite conciliación contable automática contra las compras y la facturación de ventas.
