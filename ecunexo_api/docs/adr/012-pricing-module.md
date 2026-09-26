# ADR-012 — Capacidad de Gestión de Precios (Pricing) y Motor Único de Resolución

**Estado:** Propuesta / En implementación (Fase 1)  
**Fecha:** 2026-09-26

## Contexto

Hoy el precio de venta es un único campo opcional `CatalogItem.BasePrice` dentro del catálogo:

- No existen listas de precios, vigencias, escalas por cantidad ni promociones.
- El ecommerce confía en el `UnitPrice` enviado por el cliente y el IVA está hardcodeado con dos
  convenciones (`15` en compras, `0.15` en ecommerce).
- Editar `BasePrice` sobrescribe el valor anterior: sin historial, sin vigencia y con
  `updated_by` frecuentemente nulo.
- Inventario no persiste costo; no hay margen ni descuento máximo.

Se necesita separar `Producto`, `Stock`, `Costo`, `Precio de venta`, `Promociones`, `Descuentos`,
`Impuestos` y `Precio final`, con un motor único que determine el precio comercial aplicable.

## Decisión

### 1. Capacidad del módulo raíz `catalog`, no módulo satélite

Conforme a la taxonomía canónica (`ecunexo-module-taxonomy-reasoning`), las listas de precios
pertenecen al módulo `catalog`. Pricing se implementa como **contexto acotado propio** pero
licencia dentro de `catalog`:

- Permisos `catalog.pricing.read/create/update/delete`, `catalog.pricing.history.read` y
  `catalog.promotions.manage`.
- Sin cambios en `TenantModuleCodes` ni en el subsistema de licencias.
- Promoverlo a módulo raíz `pricing` requiere aprobación CEO y prompt de licenciamiento.

### 2. Contexto acotado desacoplado

- Dominio: `EcuNexo.Core/Pricing`.
- Aplicación: `EcuNexo.Business/Pricing` (`IPricingService`, comandos, queries, repositorios).
- Esquema PostgreSQL `pricing`: `price_lists`, `product_prices`, `quantity_tiers`, `promotions`,
  `promotion_targets`, `price_change_log`.
- Sellos del contexto: `tenant_id` en las entidades raíz, filtro explícito por tenant en
  repositorios y aislamiento multi-empresa verificado en tests.

### 3. Motor único de resolución

`IPricingService.ResolveAsync(PricingRequest)` es la única fuente de verdad. Ecommerce, storefront,
facturación, reparaciones y el futuro POS lo consumen; ninguno reimplementa reglas de precio.
Orden: lista → vigencia → escala → promoción → descuento → neto → impuesto → final, devolviendo
`AppliedRules`.

El cálculo puro vive en `PriceCalculator` (Core) para ser testeable sin base de datos.

### 4. Historial inmutable y lista predeterminada única

- Cambiar un precio cierra la vigencia anterior y crea una fila nueva; nunca se sobrescribe.
- `price_change_log` append-only registra quién, cuándo, precio anterior, precio nuevo, lista,
  producto y vigencia (el proyecto no tiene auditoría genérica; si se crea, este log se migra).
- Índice único parcial garantiza una sola lista predeterminada activa por empresa.

### 5. Impuestos fuera de Pricing

Facturación/SRI es dueño del cálculo fiscal. Pricing resuelve el precio neto y desglosa el IVA a
través de `ITaxRateProvider` (MVP: IVA 15% vigente, 0/5 especiales), con la bandera
`prices_include_tax` de la lista para desagregar precios de góndola. Las preguntas tributarias
abiertas de Ecuador se cierran antes de la integración (fase 4).

### 6. Snapshot de venta

Todo consumidor guarda en su detalle de venta el precio de lista, precio unitario, descuento,
neto, tarifa, impuesto, total y las reglas aplicadas. Una venta histórica nunca se recalcula.

### 7. Precisión y redondeo

`decimal`/`numeric(18,6)` para dinero; `numeric(18,4)` para cantidades; redondeo
`MidpointRounding.AwayFromZero` a 2 decimales, alineado con los validadores SRI de Facturación.

## Consecuencias

- `CatalogItem.BasePrice` queda como legado de transición con fallback explícito del motor hasta
  el corte; no se elimina sin ADR posterior.
- Se requiere migración EF `AddPricingModule` y nuevas suites de tests de dominio/aplicación.
- El ecommerce debe pasar del `UnitPrice` del cliente a la resolución server-side (fase 4).
- La UI estrena el grupo «Gestión de precios» en `ecunexo_admin` con listas, precios,
  promociones, historial y simulador.
- Fase 2 (cliente/segmento/canal/sucursal, cupones, combos, 2x1/3x2, margen mínimo y
  autorizaciones) queda habilitada por el modelo sin rediseño.
