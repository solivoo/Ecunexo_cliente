# ADR-013 — Precios Agrupados por Capas, Mínimos de Grupo y Paquetes (Mix & Match)

**Estado:** Propuesta  
**Fecha:** 2026-11-16  
**Relacionado:** [ADR-012](012-pricing-module.md), [Manual operativo](19-manual-operativo-productos-precios.md)

## Contexto

El módulo de Pricing actual (ADR-012) resuelve precios **línea por línea (SKU individual)**:

1. `CatalogItem.MinOrderQuantity` bloquea la cantidad mínima por SKU individual; no permite exigir un mínimo surtido sobre una matriz (ej. 12 camisas entre tallas/colores) ni sobre un grupo de productos.
2. `QuantityTier` y `VolumeDiscountScheme` evalúan la cantidad de una sola línea; si un cliente combina 2 pares de un diseño + 2 de otro + 1 de otro (= 5 pares), el motor ve cantidades `2, 2, 1` y no activa el precio por volumen.
3. Los precios por paquete exacto (ej. `5 pares = $15.00`, `12 pares = $34.00`) no pueden representarse sin pérdida por redondeo mediante precio unitario de 2 decimales (`12 × 2.83 = $33.96 ≠ $34.00`).
4. `PromotionTargetType` solo soporta `Product`, `Variant` y `AllItems` (`*`); no permite apuntar a `Category`, `Matrix` ni combinar inclusiones/exclusiones (ej. *"categoría Calcetines, excepto Deportiva Premium"*).

Para soportar múltiples modelos comerciales (retail, mayorista, paquetes surtidos por matriz/categoría/selección) sin acoplar reglas de negocio al catálogo ni duplicar configuraciones por SKU, se define una arquitectura ordenada en **4 capas**.

---

## Decisión

### Capa 1 — Catálogo (`EcuNexo.Core/Catalog`)
- Responsabilidad exclusiva: identidad del producto (`SKU`, `Matriz + Variantes`, `Categoría`, `Atributos`).
- **Mínimo físico opcional:** `MinOrderQuantity` + `MinOrderScope` (`PerSku = 0`, `PerMatrix = 1`). Se usa únicamente cuando el producto o matriz tiene prohibida la venta por debajo de N unidades físicas. No define precios ni descuentos.

### Capa 2 — Tarifa Base (`ProductPrice` en `EcuNexo.Core/Pricing`)
- Responsabilidad exclusiva: precio unitario base de 1 unidad por `PriceList` y vigencia temporal con historial inmutable (`price_change_log`).
- Responde siempre: *«¿Cuál es el precio base de 1 unidad de este SKU en esta lista?»*.

### Capa 3 — Reglas de Volumen y Paquetes (`VolumeRule` en `EcuNexo.Core/Pricing`)
Unifica las reglas de volumen agrupadas con alcance flexible:

1. **Alcance (`volume_rule_targets`):**
   - `TargetType`: `AllItems` (`*`), `Category`, `Matrix` (ítem padre), `Product`, `Variant`.
   - `IsExclusion` (`bool`): permite incluir una categoría o matriz y excluir SKUs puntuales.
2. **Modo de agrupación (`GroupingMode`):**
   - `PerLine = 0`: evalúa cada SKU por separado.
   - `PerMatrix = 1`: suma cantidades de todas las variantes del mismo `ParentId`.
   - `PerGroup = 2`: suma cantidades de todas las líneas del carrito que coincidan con el alcance de la regla (Mix & Match).
3. **Política de mínimo del grupo:**
   - `MinGroupQuantity` (`decimal?`): cantidad mínima del grupo para activar o permitir la regla.
   - `EnforceMinPurchase` (`bool`):
     - `true`: impide confirmar compra si el grupo tiene unidades `> 0` y `< MinGroupQuantity`.
     - `false`: permite comprar por debajo de `MinGroupQuantity` a tarifa base y activa la escala al alcanzar el mínimo.
4. **Tramos (`volume_rule_tiers`):**
   - `QuantityFrom`, `QuantityTo` (`decimal?`).
   - `TierPricingMode`:
     - `Percentage = 0` (`-X%`)
     - `FixedDiscount = 1` (`-$X c/u`)
     - `FixedUnitPrice = 2` (`$X c/u`)
     - `PackagePrice = 3` (`QuantityFrom` unidades por `$Y` exactos, ej. `5 = $15.00`, `12 = $34.00`).
5. **Precedencia:** `Priority` explícita (y desempate determinista por mayor especificidad del target o mejor beneficio según configuración).

### Capa 4 — Motor Único de Carrito (`IPricingService.ResolveCartAsync`)
Pipeline único consumido por **Storefront**, **Facturación**, **POS** y **Simulador**:

1. **Tarifa base:** resuelve el `ProductPrice` vigente por cada línea.
2. **Reglas de volumen/paquetes:** agrupa líneas según `GroupingMode`, valida `EnforceMinPurchase`, selecciona el tramo aplicable y, en `PackagePrice`, prorratea el monto exacto entre las líneas del grupo ajustando el residuo de redondeo en la última línea para cuadrar al centavo con Facturación/SRI.
3. **Promociones / Cupones:** aplica campañas temporales (`Priority` e `IsStackable`) sobre el resultado.
4. **Impuestos:** desglosa IVA (`ITaxRateProvider` + `PricesIncludeTax`) y devuelve el snapshot completo con `AppliedRules`.

---

## Plan de Implementación

1. **Fase 1 — Dominio, Persistencia y Motor (`EcuNexo.Core` / `Data` / `Business`):**
   - Agregar `MinOrderScope` en `CatalogItem` y validación agrupada por `ParentId` en `CreateStorefrontOrderHandler`.
   - Crear entidades `VolumeRule`, `VolumeRuleTarget`, `VolumeRuleTier` (esquema `pricing`) + migración EF.
   - Implementar `PriceCalculator` agrupado y `IPricingService.ResolveCartAsync` con tests unitarios de prorrateo exacto (ej. `12 = $34.00`).
2. **Fase 2 — API v1 y Simulador:**
   - Endpoints CRUD para `VolumeRules` y endpoint `POST /api/v1/pricing/resolve-cart`.
   - Actualizar el Simulador de carrito en `ecunexo_admin` para usar `resolve-cart`.
3. **Fase 3 — UI Admin y Storefront:**
   - Nueva vista de **Reglas por grupo y paquetes** en `ecunexo_admin` (alcance por categoría/matriz/SKUs + exclusiones, mínimo obligatorio o por tramo, y tramos con `PackagePrice`).
   - Mostrar aviso de mínimo de grupo y descuento por paquete en tiempo real en el carrito del storefront.

## Consecuencias

- Se mantiene compatibilidad con `ProductPrice` y `QuantityTier` actuales mientras se migra el consumo del carrito hacia `ResolveCartAsync`.
- `ProductPriceFormPage` permanece enfocado en la **Capa 2 (Tarifa Base)** y escalas simples por SKU, sin sobrecargarse con reglas multi-producto.
- Facturación/SRI recibe líneas con montos exactos prorrateados al centavo sin discrepancias en totales.
