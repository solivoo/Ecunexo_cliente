# Sistema de precios actual

> **Estado:** **implementado** (no es propuesta). Actualizado 2026-11-16.
> **Flujo operativo en UI:** [`19-manual-operativo-productos-precios.md`](19-manual-operativo-productos-precios.md).
> **ADR (contexto de decisión):** [`adr/012-pricing-module.md`](adr/012-pricing-module.md) — si el ADR habla de “Fase 1 / propuesta”, **este documento manda sobre el estado actual**.

---

## 0. Regla de oro (léela primero)

| Concepto | Dónde vive | Cómo se crea / actualiza |
|---|---|---|
| Identidad del producto (SKU, fotos, variantes) | `catalog.items` | Catálogo (ítems / matriz) |
| Stock | `inventory.*` | Compras → Recibir, o Inventario → Documento recepción **aprobado** |
| Costo real (promedio) | stock / kárdex (`AverageCost`) | Misma recepción; **no** se edita en Gestión de precios |
| Costo estimado opcional | `catalog.items.cost_price` | Solo referencia si aún no hay kárdex |
| **PVP / precio comercial** | esquema **`pricing.*`** (`product_prices`) | **Solo** Gestión de precios / API `catalog/pricing/*` |
| Fallback legado | `catalog.items.base_price` | Solo si **no** hay `product_price` vigente y la lista es la **predeterminada** |

**Nunca** trates `CatalogItem.BasePrice` como el sistema de precios “oficial”. Es transición + fallback. El storefront, admin y ecommerce deben resolver con `IPricingService.ResolveAsync` / `POST .../catalog/pricing/resolve`.

---

## 1. Arquitectura actual (código)

| Capa | Ubicación |
|---|---|
| Dominio | `src/EcuNexo.Core/Pricing/` (`PriceList`, `ProductPrice`, `QuantityTier`, `VolumeDiscountScheme`, `Promotion`, `PriceCalculator`, …) |
| Aplicación | `src/EcuNexo.Business/Pricing/` (`PricingService`, comandos/queries) |
| Persistencia | esquema PostgreSQL **`pricing`** (EF en `EcuNexo.Data`) |
| HTTP | `src/EcuNexo.Api/Endpoints/V1/Pricing/PricingEndpoints.cs` |
| Admin UI | `Cliente/ecunexo_admin/src/pages/catalog/pricing/` + menú `catalogo/precios/*` |
| Licencia / permisos | Capacidad dentro del módulo raíz **`catalog`** (no módulo satélite `pricing`) |

### Tablas (`pricing.*`)

- `price_lists` — listas (`PUBLICO`, `MAYORISTA`, …); **una sola** `is_default` activa por tenant.
- `product_prices` — PVP por `(lista, catalog_item_id)` con vigencia (`valid_from` / `valid_to`); cambio = cerrar vigencia + fila nueva (+ log).
- `quantity_tiers` — tramos **manuales** de un `product_price` (precio unitario fijo por cantidad).
- `volume_discount_schemes` + `volume_discount_tiers` — esquemas **reutilizables** (% / monto / precio fijo).
- `promotions` + `promotion_targets` — campañas / cupones.
- `price_change_log` — historial append-only.

### Permisos

`catalog.pricing.read|create|update|delete`, `catalog.pricing.history.read`, `catalog.promotions.manage|deactivate`.

### Endpoints (prefijo)

`/api/v1/tenants/{tenantId}/catalog/pricing/`

| Recurso | Rutas clave |
|---|---|
| Listas | `GET/POST price-lists`, `PUT/DELETE price-lists/{id}` |
| Precios | `GET/POST prices`, `POST prices/bulk`, `PUT/DELETE prices/{id}`, `GET prices/history` |
| Esquemas volumen | `GET/POST/PUT/DELETE volume-schemes`, `POST volume-schemes/bulk-assign` |
| Promos | `GET/POST/PUT/DELETE promotions`, `PUT promotions/{id}/active` |
| Motor | `POST resolve` |

---

## 2. Orden de resolución del motor

Implementación: `PricingService.ResolveAsync` → `PriceCalculator.Calculate`.

1. Validar cantidad `> 0` e ítem activo.
2. Resolver lista (`PriceListId` o lista default del tenant).
3. Buscar `product_price` **vigente** para `(lista, ítem)`.
4. Si no hay y el ítem es **variante** (`ParentId`): buscar precio vigente del **padre** → regla `PRECIO_HEREDADO_PADRE`.
5. Si aún no hay precio:
   - Solo si la lista es **default** (o no hay lista): usar `CatalogItem.BasePrice > 0` (o del padre) → `PRECIO_BASE_CATALOGO`.
   - Si la lista **no** es default: **error** `catalog.pricing.price.not_found` (no hay fallback a `base_price`).
6. Escala por cantidad (**mutuamente excluyente**):
   - Si hay **algún** `QuantityTier` activo que aplique → usa ese unit price (`ESCALA_*`).
   - Si **no** hay tramo manual aplicable y hay `VolumeDiscountScheme` activo → aplica % / $ / precio fijo del esquema (`ESQUEMA_*`).
7. Promociones aplicables (ítem / padre / tienda `*`) + cupón opcional → descuento según tipo/prioridad/acumulabilidad.
8. Impuesto vía `ITaxRateProvider` + bandera `prices_include_tax` de la lista (o override del request).
9. Margen informativo: preferir `AverageCost` de stock; si no, `cost_price` del ítem/padre.

**Consumidores:** no recalcular reglas en el cliente. Guardar snapshot de venta (lista, unitario, descuento, neto, IVA, total, `AppliedRules`).

---

## 3. Cómo SÍ crear productos y precios

### 3.1 Producto estándar (1 SKU)

1. **Catálogo → Ítems → Nuevo** (tipo estándar).
2. Identidad + SKU único. Opcional: `cost_price` estimado; opcional: `base_price` solo como red de seguridad.
3. Stock/costo real:
   - **Con factura:** Compras → documento → **Recibir compra** (bodega).
   - **Sin factura:** Inventario → recepción → **Aprobar** (no basta Guardar).
4. PVP: **Gestión de precios** (matriz / precio puntual / carga lote) en lista default (`PUBLICO`).
5. Validar: **Simulador** o `POST .../resolve`.

### 3.2 Producto con matriz (plantilla / variantes)

1. Crear padre + variantes (cada variante = SKU vendible).
2. Stock y costo en **cada variante** (no en el padre vacío).
3. PVP preferible en **cada variante**. Precio solo en el padre funciona por herencia, pero es frágil si variantes divergen.
4. Storefront lista **raíces**; compra la variante.

### 3.3 Formas correctas de escribir PVP

| Forma | Cuándo | API / UI |
|---|---|---|
| Matriz de precios | Ajuste rápido multi-SKU / multi-lista viendo costo y margen | UI `catalogo/precios/matriz` (usa create/bulk de precios) |
| Precio puntual | Un SKU, tramos manuales, vigencia/motivo | `POST .../prices` + UI form |
| Carga por lote | Muchos SKUs, misma vigencia/motivo | `POST .../prices/bulk` |
| Asignar esquema volumen | Misma escala a N precios existentes | `POST .../volume-schemes/bulk-assign` |
| Promoción / cupón | Campaña temporal o código | `.../promotions` |

Crear/actualizar precio **cierra** la vigencia anterior y escribe `price_change_log`. No hay “UPDATE in place” del valor histórico.

### 3.4 Listas

- Debe existir **exactamente una** lista predeterminada activa (típicamente `PUBLICO`, moneda `USD`).
- `prices_include_tax = true` → el número en `product_prices.price` es **PVP con IVA** (retail Ecuador habitual).
- `prices_include_tax = false` → el número es **neto**; el motor suma IVA.
- Listas no default (`MAYORISTA`, etc.): **obligatorio** `product_price` por ítem; `base_price` del catálogo **no** aplica.

---

## 4. Cómo NO hacerlo (anti-patrones)

| ❌ No hacer | Por qué |
|---|---|
| Poner solo `CatalogItem.BasePrice` / campo “precio base” en el alta y dar por terminado el PVP | Fallback incompleto: sin escalas, sin historial, sin listas no-default; storefront puede fallar o mostrar inconsistencias |
| Escribir PVP en Inventario o Compras | Esos módulos solo mueven stock/costo |
| Soft-update SQL directo a `product_prices.price` sin cerrar vigencia / sin log | Rompe auditoría e invariantes del agregado |
| Mezclar tramos manuales (`quantity_tiers`) **y** esperar que el esquema de volumen también aplique | Precedencia: tramo manual gana; el esquema se ignora si hay tier aplicable |
| Poner stock/precio solo en el **padre** de matriz y olvidar variantes | Stock vendible y PVP deben estar en SKUs; herencia de precio es contingencia, no diseño |
| Confiar en `UnitPrice` enviado por el cliente ecommerce | El servidor debe resolver con el motor |
| Usar promoción para “descuento por cantidad permanente” | Eso es `VolumeDiscountScheme` o `QuantityTier`; promo es temporal/cupón |
| Crear segunda lista `is_default=true` | Índice único parcial; falla o deja el tenant inconsistente |
| Tratar ADR-012 “Fase 1 / BasePrice primario” como estado actual | Obsoleto respecto al código; este doc + motor mandan |
| Dejar `product_prices` vacío en tenant de prueba y asumir que “ya tiene precio” porque hay `base_price` | Solo cubre lista default; márgenes/escalas/historial no existen |

---

## 5. Escalas vs promociones (contrato corto)

| Mecanismo | Persistencia | Semántica |
|---|---|---|
| Tramos manuales | `quantity_tiers` colgando de un `product_price` | Precio unitario fijo por rango de qty; **exclusivo** de ese precio |
| Esquema volumen | `volume_discount_schemes` → FK en `product_prices` | Reutilizable; % / monto / precio fijo |
| Promoción | `promotions` (+ targets) | Fechas / cupón / prioridad / acumulabilidad; no sustituye lista |

Precedencia cantidad: **QuantityTier activo aplicable XOR VolumeScheme** (tiers primero).

---

## 6. Mapa UI admin (rutas)

| Ruta | Uso |
|---|---|
| `catalogo/precios/listas` | CRUD listas |
| `catalogo/precios/productos` | Listado, form, lote, asignar esquema |
| `catalogo/precios/matriz` | Edición rápida celda a celda + margen |
| `catalogo/precios/escalas-volumen` | Esquemas reutilizables |
| `catalogo/precios/promociones` | Campañas / cupones |
| `catalogo/precios/historial` | Auditoría |
| `catalogo/precios/simulador` | Probar resolve |

---

## 7. Checklist mínimo antes de “está listo para vender”

- [ ] Ítem/variantes **Activos** (y visibles en vitrina si aplica).
- [ ] Stock `> 0` en bodega de despacho si el canal controla existencias (documento **aprobado**).
- [ ] Fila vigente en `pricing.product_prices` para lista default (idealmente por **variante**).
- [ ] `POST resolve` / Simulador: qty 1 (y qty de escala si aplica) → precio + reglas coherentes.
- [ ] Si usas lista no-default: precio explícito en esa lista (sin depender de `base_price`).

---

## 8. Datos de entorno local útiles

- API: `http://localhost:5088` — prefijo `/api/v1`.
- Dev token: `POST /api/v1/auth/dev-token` `{ userId, tenantId }` (solo Development).
- Tenant prueba frecuente Everchic: `01a082f0-b204-7aae-b7d5-ede5dd9a477a`.
- Al verificar con datos de prueba: limpiar pedidos, stock reservado y promociones temporales al terminar.

---

## 9. Archivos ancla (si el código diverge de este doc)

1. `EcuNexo.Business/Pricing/PricingService.cs` — orquestación y fallback.
2. `EcuNexo.Core/Pricing/PriceCalculator.cs` — cálculo puro.
3. `EcuNexo.Api/Endpoints/V1/Pricing/PricingEndpoints.cs` — contrato HTTP.
4. `EcuNexo.Core/Pricing/ProductPrice.cs` — invariantes de vigencia / tiers.
5. Menú seed: `EcuNexo.Api/Development/MenuCatalogSeedData.cs` (entradas `catalog-pricing-*`).

Si encuentras conflicto entre UI, ADR y motor: **prioriza el motor (`PricingService` + `PriceCalculator`) y actualiza este documento**.
