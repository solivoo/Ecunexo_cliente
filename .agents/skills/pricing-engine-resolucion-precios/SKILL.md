---
name: pricing-engine-resolucion-precios
description: >-
  Motor central de resolución de precios de EcuNexo (PricingService): contrato de entrada/salida,
  orden de resolución (lista → vigencia → escala → promoción → descuento → impuesto → precio final),
  prioridades y acumulabilidad, redondeo decimal, snapshot de ventas, integración con ecommerce,
  storefront y facturación SRI Ecuador. Úsala al implementar o consumir cálculo de precios.
---

# Pricing Engine: Resolución de Precios y Snapshot de Venta

`IPricingService` es la **única fuente de verdad** para determinar el precio comercial aplicable.
Ningún módulo (POS, ventas, ecommerce, cotizaciones, facturación, storefront) reimplementa reglas
de precio, descuentos, escalas ni promociones: todos llaman a este servicio.

El dominio (listas, precios, escalas, promociones, persistencia y permisos) vive en la skill
`pricing-listas-precios-vigencias`. La UI en `pricing-ui-gestion-simulador`.

---

## 1. Contrato (adaptado a C# / CQRS del proyecto)

```csharp
public sealed record PricingRequest(
    Guid CatalogItemId,
    decimal Quantity,                 // > 0; admite decimales (granel)
    DateOnly Date,                    // fecha de aplicación
    Guid? CustomerId = null,          // reservado fase 2
    Guid? PriceListId = null,         // si null → lista del cliente o predeterminada
    Guid? BranchId = null,            // reservado fase 2
    Guid? WarehouseId = null,         // reservado fase 2
    string? Channel = null);          // reservado fase 2 (web | pos | mostrador)

public sealed record PricingResult(
    Guid CatalogItemId,
    Guid PriceListId,
    string PriceListCode,
    decimal ListPrice,                // precio vigente de la lista
    decimal UnitPrice,                // ListPrice o precio de escala
    decimal? TierPrice,
    string? TierLabel,                // ej. "6 a 20 unidades"
    decimal Subtotal,                 // UnitPrice * Quantity
    decimal DiscountAmount,
    decimal NetPrice,                 // Subtotal - DiscountAmount
    decimal TaxRate,                  // tarifa efectiva (ej. 0.15)
    decimal TaxAmount,
    decimal FinalPrice,               // NetPrice + TaxAmount
    bool PricesIncludeTax,
    string Currency,                  // "USD"
    IReadOnlyList<string> AppliedRules); // LISTA_MAYORISTA, ESCALA_6_20, PROMO_SEPTIEMBRE
```

La implementación vive en `EcuNexo.Business/Pricing/IPricingService.cs` + `PricingService.cs` y
retorna `Result<PricingResult>` (patrón `EcuNexo.Core.Common`). El cálculo puro se aísla en un
`PriceCalculator` de dominio (`EcuNexo.Core/Pricing/`) para poder probarlo sin base de datos.

---

## 2. Orden de resolución (estrategia oficial)

```text
1. Identificar la lista de precios.
2. Obtener el precio vigente del producto en esa lista.
3. Evaluar escala por cantidad.
4. Evaluar promociones aplicables.
5. Aplicar descuentos permitidos (prioridad / acumulabilidad).
6. Obtener precio neto.
7. Calcular impuestos con el mecanismo tributario vigente.
8. Obtener precio final.
```

### Paso 1 — Lista de precios
Prioridad: (a) `PriceListId` explícito del request; (b) lista asignada al cliente — fase 2;
(c) lista `is_default` activa del tenant; (d) error `catalog.pricing.price_list.default.required`.
La lista debe estar vigente y activa, y pertenecer al tenant del contexto.

### Paso 2 — Precio vigente
Buscar en `product_prices` por `(tenant, price_list_id, catalog_item_id)` con
`valid_from <= fecha` y (`valid_to IS NULL` o `valid_to >= fecha`), activo. Si no existe y el
ítem es una variante, heredar del padre matriz (misma lista) y dejarlo en `AppliedRules`
(`PRECIO_HEREDADO_PADRE`). Si es ítem simple sin padre y no hay precio, error
`catalog.pricing.price.not_found` (nunca devolver 0 silencioso).

### Paso 3 — Escala por cantidad
Elegir la escala activa cuyo `quantity_from <= Quantity` y (`quantity_to IS NULL` o
`quantity_to >= Quantity`). Si hay varias, la de mayor `quantity_from`. `UnitPrice = tier.unit_price`
y `TierLabel` para trazabilidad. Cantidad exacta en el borde superior pertenece a esa escala.

### Paso 4 — Promociones
Candidatas: activas, `starts_at <= fecha <= ends_at`, y con target que coincida con el ítem
(`product`, `variant`) o su categoría (`category`). Ordenar por `priority DESC`, luego por
beneficio aplicado `DESC`. Ver §3.

### Paso 5-6 — Descuento y neto
`Subtotal = UnitPrice * Quantity` (redondeo solo al final por línea).
Tipos: `percentage` (`Subtotal * value / 100`), `fixed_amount` (`value` por unidad o por línea
según se documente en la promoción), `fixed_price` (el precio unitario pasa a ser `value`).
`NetPrice = Subtotal - DiscountAmount`, nunca menor a 0.

### Paso 7 — Impuestos (Ecuador)
El impuesto pertenece al dominio tributario, no a Pricing. Reglas:
* Si `list.prices_include_tax = true`, el `NetPrice` mostrado es el precio de góndola: se
  desagrega base e IVA (`base = net / (1 + rate)`, `tax = net - base`).
* Si es `false`, `tax = net * rate` y el precio final es base + IVA.
* Tarifa obtenida de `ITaxRateProvider`. Implementación `BillingTaxRateProvider`: consulta
  `GET /api/v1/catalogs/tax-rates` de Facturación (`TaxCode` 2, `DefaultRateCode` configurable,
  por defecto 4 = 15%), cachea por fecha y cae a `FallbackRate` (15%) si el servicio no responde.
  La tarifa por ítem (0/5/no objeto/exento) es una decisión de negocio pendiente; hoy es única
  por tenant. Prohibido hardcodear `15`, `0.15` o `0m` en módulos consumidores.
* Prohibido hardcodear `15`, `0.15` o `0m` en módulos consumidores; siempre `TaxRateProvider`.
* Redondeo fiscal (SRI): `Math.Round(x, 2, MidpointRounding.AwayFromZero)`.

### Paso 8 — Resultado
Devolver el desglose completo con `AppliedRules` (lista, escala, promoción, herencia, impuesto).
El frontend **solo pinta** este desglose; no recalcula.

---

## 3. Prioridad y acumulabilidad (conflictos)

Estrategia explícita, documentada y probada:

1. Se filtran promociones aplicables y se ordenan por `priority` descendente (mayor primero).
2. Se acumulan las promociones con `is_stackable = true` en orden de prioridad.
3. Al encontrar la primera promoción con `is_stackable = false`, se aplica **solo esa** (la de
   mayor prioridad) y se detiene la acumulación: las de menor prioridad se descartan.
4. Empate de prioridad entre no acumulables: gana la que produce mayor descuento; si persiste el
   empate, el desempate final es por `code` ascendente (determinista y auditable).
5. Las reglas descartadas no se listan en `AppliedRules`; opcionalmente el simulador puede
   mostrar `discardedRules` en el resultado para soporte.

La decisión es **backend**; el frontend jamás decide qué promoción gana.

---

## 4. Precisión y redondeo

* Dinero y cantidades: `decimal` / `numeric(18,6)`. Prohibido `float`/`double`.
* Redondeo monetario: `AwayFromZero` a 2 decimales, en el orden: escala → promoción → impuesto.
* Evitar redondear pasos intermedios; redondear al asignar cada monto del resultado.
* Nota del ecosistema: Facturación usa `Money` con 2 decimales y validadores `AwayFromZero`;
  el precio unitario de la línea SRI admite hasta 6 decimales (`numeric(18,6)`). Mantener
  coherencia en el snapshot (ver §5).

---

## 5. Snapshot de ventas (histórico inmutable)

Toda venta/pedido debe **congelar** el resultado del motor en su detalle. Una venta histórica
nunca se recalcula con reglas actuales.

Campos requeridos en el detalle de venta (adaptar a cada entidad consumidora):

```text
CatalogItemId, Quantity,
CostUnitPrice        (según inventario cuando exista costo; hoy no hay columna de costo)
PriceListId, ListPrice, UnitPrice,
DiscountAmount, DiscountPercentage,
NetPrice, TaxRate, TaxAmount, Subtotal, TotalAmount
AppliedRulesJson     (opcional, jsonb: trazabilidad de promociones/escalas)
```

Aplicación al estado actual:
* `EcommerceOrderItem` (`Core/Ecommerce/EcommerceOrderItem.cs`) hoy guarda `UnitPrice`,
  `DiscountAmount`, `TaxRate (0.15 fracción)`, `TaxAmount`, `TotalAmount`. Agregar
  `PriceListId`, `ListPrice` y `AppliedRulesJson`; `UnitPrice` pasa a ser el precio neto unitario
  resuelto.
* `InvoiceLine` de Facturación (`Billing.Core/Documents/InvoiceLine.cs`) ya es un snapshot
  (`UnitPrice`, `Discount`, `LineTotalWithoutTax`, `Taxes`). La SPA debe llenarlo con
  `POST /pricing/resolve` en lugar de calcular IVA localmente.
* No crear columnas de precio en `Inventory` ni en `CatalogItem` para "guardar el último precio".

---

## 6. Integración con consumidores

| Consumidor | Estado actual | Cambio requerido |
|---|---|---|
| Ecommerce (`CreateEcommerceOrderHandler`) | Confía en `UnitPrice` enviado por el cliente (`EcommerceContracts.cs`) | Resolver server-side con `IPricingService`; ignorar/eliminar `UnitPrice` del request |
| Storefront público (`ListStorefrontProductsHandler`) | Usa `CatalogItem.BasePrice` | Usar precio de lista predeterminada (o mostrar rango de variantes) |
| Facturación (SPA + `Billing.Api`) | SPA calcula IVA (0/5/15) y Billing valida/recalcula cabecera | SPA llama `resolve` y envía snapshot; Billing no cambia |
| Reparaciones (`GetDispatchInvoicePreview`) | IVA 15% fijo + tarifas N1/N2/N3 | Fase 2: tarifas al motor con lista por cliente |
| POS / Ventas | No existe aún | Nace consumiendo el motor |

Regla dura: un pedido/venta sin lista o precio vigente **se rechaza** con
`ecommerce.order.price_not_configured`; ya no se acepta el precio enviado por el cliente. La
migración `BackfillPricingFromBasePrice` crea la lista `PUBLICO` por tenant y copia `BasePrice` a
`product_prices` para la transición.

---

## 7. Impuestos Ecuador — alcance y preguntas abiertas

Lo que ya existe en el ecosistema (no duplicar):
* Catálogo de tarifas SRI en Facturación: `Billing.Infrastructure/Persistence/BillingCatalogSeeds.cs`
  (IVA 0% rate code `0`, 5% `5`, 15% `4`, no objeto `6`, exento `7`; 12%/14% históricos con
  vigencia).
* Validación fiscal en `Billing.Core` (`InvoiceLineValidator`, `InvoiceTotalsCalculator`): la
  base es el neto sin impuesto y el IVA se suma; `Money` a 2 decimales.
* La SPA factura con IVA 0/5/15 y `rateCode` 0/5/4.

Preguntas a cerrar con contabilidad/negocio antes de la fase 4 (documentar en el ADR de Pricing):
1. ¿Los precios de lista de góndola se cargan con IVA incluido o como base? (`prices_include_tax`).
2. ¿Qué tarifa aplica por ítem/categoría (15% general, 5% especial, 0%, no objeto, exento)?
3. ¿El motor devuelve `FinalPrice` con IVA o el IVA se agrega solo al facturar?
4. Redondeo en Ecuador: confirmar `AwayFromZero` a 2 decimales extremo a extremo.
5. Notas de crédito/devoluciones: el snapshot de la venta original es la fuente, no el precio actual.
6. RIMPE / retenciones: no afectan el precio unitario; pertenecen a Facturación.

Mientras se cierra: MVP con `ITaxRateProvider` por defecto 15% y desagregación cuando
`prices_include_tax = true`.

---

## 8. Rendimiento y evolución

* Una resolución = una consulta por agregado (precio+tiers+promociones filtradas), `AsNoTracking`;
  prohibido N+1 dentro de loops de venta.
* Diseñado detrás de `IPricingService` para insertar `IMemoryCache` o caché distribuido después,
  invalidando por `(tenant, item, lista)` al cambiar precios. No cachear en el MVP.
* Fase 2 ya está prevista: el `PricingRequest` reserva `CustomerId`, `BranchId`, `WarehouseId`,
  `Channel`; `promotion_targets` admite `brand`, `customer`, `segment`, `channel`; las listas
  admiten `priority`. No agregar tablas que impidan precios por cliente/segmento/sucursal/canal,
  cupones, combos, 2x1/3x2, margen mínimo ni autorizaciones.
* Costos: cuando Inventario implemente costo promedio/last cost, Pricing podrá consultarlo por
  una abstracción (`IInventoryCostProvider`) para validar margen; **jamás** lo modificará.

---

## 9. Tests obligatorios del motor

En `tests/EcuNexo.Core.UnitTests/Pricing/` (cálculo puro) y
`tests/EcuNexo.Business.UnitTests/Pricing/` (orquestación y tenant):

```text
Precio público normal                       Precio de lista mayorista
Precio vigente según fecha                  Precio con escala por cantidad
Borde exacto de escala                      Promoción porcentual
Descuento de valor fijo                     Precio fijo promocional
Promoción vencida                           Promoción futura
Dos promociones con distinta prioridad      Promoción no acumulable
Producto sin precio configurado             Producto de otra empresa (aislamiento)
Cálculo de impuestos (incluye IVA / suma IVA)   Precisión decimal (0.005 → AwayFromZero)
Herencia de precio padre matriz             Lista predeterminada única
```

Los tests se centran en reglas de negocio, no en CRUD. Complementar con un caso E2E de simulador.
