---
name: ecommerce-pedidos-stock
description: >-
  Estándares de arquitectura, ciclo de vida de pedidos online, reserva atómica de inventario,
  despacho con couriers y facturación electrónica para el módulo Ecommerce de EcuNexo.
---

# Módulo de Ecommerce & Gestión de Pedidos Online

Esta skill recopila la arquitectura del módulo de comercio electrónico en EcuNexo (`EcommerceOrder`), regulando el ciclo de vida del pedido, la prevención de sobreventas mediante reservas atómicas de stock y el despacho logístico.

---

## 1. Ciclo de Vida del Pedido Online

El pedido transita por estados estrictamente auditados:
1. `Pending (Pendiente)`: El cliente generó la orden en la tienda web.
2. `Confirmed (Confirmado)`: Pago verificado o pedido contra-entrega aceptado. **Aplica reserva atómica de inventario** en la bodega asignada.
3. `InPreparation (En Preparación)`: En zona de empaque (picking & packing).
4. `Dispatched (Despachado)`: Entregado al courier o transportista con número de guía (`CarrierTrackingNumber`). **Asienta egreso definitivo de stock y kárdex**.
5. `Delivered (Entregado)`: Concluido satisfactoriamente con el cliente final.
6. `Cancelled (Cancelado)`: Anulado antes de la entrega; **libera de inmediato la reserva de stock** devolviendo disponibilidad a la tienda.

---

## 2. Prevención de Sobreventas (Stock Reservation Pattern)

* Para evitar vender mercadería que no existe durante compras simultáneas:
  * Al confirmar el pedido, se invoca `ReserveStockAsync(warehouseId, itemId, quantity)`.
  * Incrementa `QuantityReserved` en `StockBalance` sin alterar `QuantityOnHand`.
  * La tienda online consulta siempre `QuantityAvailable = QuantityOnHand - QuantityReserved`.
* Al despachar:
  * Se libera la reserva y se disminuye `QuantityOnHand`, asentando la salida en el Kárdex de inventario.

---

## 3. Despacho y Logística E-commerce

* **Asignación de Courier / Transportista:** Servientrega, Laar Courier, Urbano, motorizados propios.
* **Trazabilidad:** Registro de número de guía, enlace de rastreo en línea y fecha/hora estimada de entrega.
* **Integración con Facturación Electrónica:** Vinculación directa con `BillingInvoiceId` para emitir la factura autorizada del SRI al cliente final.
