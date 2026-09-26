---
name: pricing-listas-precios-vigencias
description: >-
  Modelo de dominio, reglas de negocio, persistencia y API de la Gestión de Precios de EcuNexo:
  listas de precios, precio por producto con vigencia, escalas por cantidad, promociones con
  prioridad/acumulabilidad, historial auditable y aislamiento multi-empresa. Úsala al crear o
  modificar entidades, migraciones, permisos, endpoints, seeders o pantallas de precios.
---

# Gestión de Precios (Pricing): Listas, Vigencias, Escalas y Promociones

Esta skill define el dominio comercial de precios de EcuNexo. El precio deja de ser un atributo
suelto del catálogo (`CatalogItem.BasePrice`) y pasa a ser un **contexto acotado propio** que
determina qué precio corresponde aplicar, sin acoplarse a stock, costos ni tributación.

El motor de cálculo (orden de resolución, promociones, impuestos y snapshot de ventas) vive en la
skill `pricing-engine-resolucion-precios`. La UI en `pricing-ui-gestion-simulador`.

---

## 1. Separación estricta de responsabilidades

```text
CATÁLOGO                 GESTIÓN DE PRECIOS              INVENTARIO
Identidad del ítem  ──►  Listas / vigencias / escalas ──► stock, kárdex,
SKU, variantes,          promociones / prioridades        costo promedio (futuro)
atributos, fotos                                              │
       │                        │                             │
       ▼                        ▼                             ▼
               PRICING SERVICE (única fuente de verdad del precio)
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                Ecommerce       Ventas/POS     Facturación (SRI)
                                (futuro)       impuestos + snapshot
```

| Dominio | Es dueño de | Nunca debe |
|---|---|---|
| `catalog` | Ítem, SKU, variantes, atributos, fotos, categoría | Guardar la lógica comercial de precios |
| `pricing` (esta capacidad) | Listas, precios, vigencias, escalas, promociones, prioridades, historial | Escribir costos, stock o impuestos |
| `inventory` | Stock, kárdex, movimientos, bodegas y **costos** | Definir precio de venta |
| `facturacion` / SRI | Tarifas de impuesto vigentes, cálculo fiscal, XML, snapshot fiscal | Resolver listas ni promociones |
| Ventas / Ecommerce / POS | Persistir el snapshot resuelto; jamás recalcular | Implementar reglas de pricing |

Regla dura: **ningún módulo consumidor recalcula precios**. Todos llaman a `IPricingService`.

---

## 2. Ubicación taxonómica (RBAC, menú y licencias)

Según la skill `ecunexo-module-taxonomy-reasoning`, las listas de precios son una capacidad del
módulo raíz **`catalog`** (no un módulo satélite). Por tanto:

* **Permisos canónicos** (formato `^[a-z0-9]+(\.[a-z0-9]+)*$`):

| Permiso | Uso |
|---|---|
| `catalog.pricing.read` | Ver listas, precios e historial |
| `catalog.pricing.create` | Crear listas y precios |
| `catalog.pricing.update` | Editar precios, cerrar/abrir vigencias |
| `catalog.pricing.delete` | Desactivar listas/precios (nunca borrado físico del historial) |
| `catalog.pricing.history.read` | Consultar bitácora de cambios de precio |
| `catalog.promotions.manage` | Alta/edición/baja de promociones |

* Se declaran en `ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs` (lista
  `Permissions`) y se aplican con `PermissionFilters.Require(...)` en los endpoints.
* El prefijo `catalog` ya existe en `TenantModuleCodes` y `PermissionModuleMapper`, por lo que
  **no se requieren cambios de licenciamiento**. Si en el futuro se promueve a módulo raíz
  `pricing`, se debe usar la skill `licenciamiento-modulo-prompt` y aprobación arquitectónica.
* Menú: nuevos ítems hijos del padre `catalog` en `MenuCatalogSeedData.MenuItems` y en el fallback
  `EcuNexo.Business/Platform/Navigation/navigation.v1.json` (ver skill de UI).

**Bounded context en código** (desacoplado aunque licencie dentro de catálogo):

```text
ecunexo_api/src/EcuNexo.Core/Pricing/            entidades, value objects e invariantes
ecunexo_api/src/EcuNexo.Business/Pricing/        comandos, queries, validators, IPricingService
ecunexo_api/src/EcuNexo.Data/Configurations/     Pricing*Configuration.cs
ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Pricing/PricingEndpoints.cs
PostgreSQL schema: pricing
```

---

## 3. Modelo de datos

Todas las tablas llevan `tenant_id` (aislamiento), auditoría `created_at/by`, `updated_at/by` y
`deleted_at/by` cuando aplique. Tipos monetarios: `numeric(18,6)`; cantidades `numeric(18,4)`.

### 3.1 `pricing.price_lists` — Lista de precios

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | Índice compuesto |
| `code` | varchar(40) | `PUBLICO`, `MAYORISTA`, `DISTRIBUIDOR`, `EMPLEADO`, `WEB`; único por tenant |
| `name`, `description` | varchar | Nombre comercial |
| `currency` | char(3) | MVP `USD` |
| `prices_include_tax` | boolean | Define si el precio cargado ya lleva IVA (ver motor) |
| `valid_from`, `valid_to` | date | Vigencia de la lista |
| `priority` | int | Desempate entre listas candidatas |
| `is_default` | boolean | **Solo una predeterminada activa por tenant** |
| `is_active` | boolean | |

Invariantes:
* Lista predeterminada única: índice único parcial
  `UNIQUE (tenant_id) WHERE is_default AND is_active AND deleted_at IS NULL`.
* `code` único por tenant entre activas: `UNIQUE (tenant_id, code)`.
* `valid_to IS NULL OR valid_to >= valid_from`.

### 3.2 `pricing.product_prices` — Precio por producto/lista/vigencia

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `price_list_id` | uuid FK → price_lists | |
| `catalog_item_id` | uuid FK → catalog.items | Puede ser ítem simple o variante (SKU) |
| `price` | numeric(18,6) | `>= 0` |
| `valid_from`, `valid_to` | date | `valid_to` NULL = vigente indefinida |
| `is_active` | boolean | |

Invariantes:
* **Nunca se sobrescribe un precio**: para cambiarlo se cierra la vigencia (`valid_to`) y se
  inserta una fila nueva. El historial es la propia tabla + `price_change_log`.
* Sin solapamientos contradictorios para `(tenant, lista, ítem)`:
  `UNIQUE (tenant_id, price_list_id, catalog_item_id, valid_from)` y validación de solapamiento
  de rangos `[valid_from, valid_to]`. Opcional robusto en PostgreSQL:
  ```sql
  ALTER TABLE pricing.product_prices
    ADD CONSTRAINT ex_product_prices_no_overlap
    EXCLUDE USING gist (
      tenant_id WITH =, price_list_id WITH =, catalog_item_id WITH =,
      daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]') WITH &&
    ) WHERE (is_active AND deleted_at IS NULL);
  ```
* `price >= 0`; vigencia válida; la lista y el ítem deben ser del mismo tenant.

### 3.3 `pricing.quantity_tiers` — Escala por cantidad

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `product_price_id` | uuid FK → product_prices (cascade) | |
| `quantity_from` | numeric(18,4) | `> 0` |
| `quantity_to` | numeric(18,4) NULL | NULL = sin límite superior |
| `unit_price` | numeric(18,6) | `>= 0` |
| `is_active` | boolean | |

Invariantes: rangos **no superpuestos** dentro del mismo `product_price_id`; `quantity_to >=
quantity_from`; escala aplicable a la cantidad vendida (ver motor).

### 3.4 `pricing.promotions` — Promoción

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `code`, `name`, `description` | varchar | Código único por tenant |
| `type` | varchar(20) | MVP: `percentage`, `fixed_amount`, `fixed_price` |
| `value` | numeric(18,6) | % en `percentage`, monto en el resto; `>= 0` |
| `starts_at`, `ends_at` | timestamptz | `ends_at IS NULL OR ends_at >= starts_at` |
| `priority` | int | Mayor gana ante conflicto |
| `is_stackable` | boolean | Si `false`, no se combina con otras no acumulables |
| `is_active` | boolean | |

Tipos reservados para fase 2 (no implementar aún, pero el enum no debe bloquearlos): `2x1`,
`3x2`, `quantity_discount`, `combo`, `coupon`. El diseño admite `conditions_json jsonb` opcional
para condiciones futuras sin migración destructiva.

### 3.5 `pricing.promotion_targets` — Alcance de la promoción

| Campo | Tipo | Regla |
|---|---|---|
| `id` | uuid PK | |
| `promotion_id` | uuid FK → promotions (cascade) | |
| `target_type` | varchar(20) | MVP: `product`, `variant`, `category`; futuro: `brand`, `customer`, `segment`, `channel` |
| `target_id` | uuid/varchar | Referencia lógica (sin FK cruzada para permitir futuros tipos) |

La promoción **nunca** se limita a un solo producto: una promoción puede tener N targets y varios
tipos. El resolvedor consulta los targets aplicables al ítem/categoría del request.

### 3.6 `pricing.price_change_log` — Bitácora de cambios (append-only)

| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `tenant_id` | uuid |
| `price_list_id`, `catalog_item_id` | uuid |
| `previous_price`, `new_price` | numeric(18,6) NULL |
| `valid_from`, `valid_to` | date |
| `changed_by`, `changed_at` | uuid, timestamptz |
| `reason` | varchar(200) NULL |

Sustituye la ausencia de un sistema genérico de auditoría: el proyecto solo tiene `IAuditable`
(columnas `created_by/updated_by`, sin interceptor ni tabla de auditoría). Este log es
**exclusivo del historial de precios** y poblado por los handlers (nunca por el frontend). Si en
el futuro se crea una auditoría genérica, esta tabla debe migrarse a ella.

---

## 4. Reglas de validación obligatorias

1. Precio `>= 0`; cantidad de escala `> 0`; descuento y valor de promoción no negativos.
2. `valid_to >= valid_from`; `ends_at >= starts_at`; promoción vencida o futura no se aplica.
3. No se permiten dos precios vigentes ambiguos para `(tenant, producto, lista, fecha)`: si hay
   solapamiento, rechazar con error de dominio (`catalog.pricing.price.overlap`).
4. Escalas sin superposición dentro del mismo precio (`catalog.pricing.tier.overlap`).
5. Registros inactivos o soft-deleted nunca participan.
6. Toda operación exige el tenant del contexto (`ITenantContext`); jamás confiar en un
   `tenantId` del body. Un recurso de otro tenant se comporta como inexistente.
7. Historial inmutable: no hay endpoint para borrar filas de `product_prices` ya vigentes; se
   cierra vigencia o se desactiva.
8. La lista predeterminada no puede desactivarse ni eliminarse sin nombrar reemplazo.

Códigos de error de dominio (patrón `Error(codigo, mensaje, tipo)`):

```text
catalog.pricing.price_list.not_found        catalog.pricing.price_list.code.duplicate
catalog.pricing.price_list.default.conflict catalog.pricing.price_list.default.required
catalog.pricing.product_price.not_found     catalog.pricing.price.overlap
catalog.pricing.price.range                 catalog.pricing.tier.overlap
catalog.pricing.tier.range                  catalog.pricing.promotion.not_found
catalog.pricing.promotion.schedule          catalog.pricing.item.not_found
```

---

## 5. Persistencia e índices (rendimiento)

Índices mínimos:

```text
product_prices: (tenant_id, catalog_item_id, price_list_id, valid_from, valid_to)
                (tenant_id, price_list_id) WHERE is_active
quantity_tiers: (product_price_id, quantity_from)
promotions:     (tenant_id, is_active, starts_at, ends_at)
promotion_targets: (promotion_id), (target_type, target_id)
price_change_log:  (tenant_id, catalog_item_id, changed_at DESC)
```

* Consultas del motor con `AsNoTracking`, una sola ida a BD por resolución (evitar N+1).
* El servicio se diseña detrás de `IPricingService` para poder añadir `IMemoryCache` después sin
  tocar consumidores; no introducir caché en el MVP.
* Migraciones con EF Core (`dotnet ef migrations add AddPricingModule`); esquema `pricing`
  configurado en cada `IEntityTypeConfiguration`. Nada de SQL manual salvo la constraint de
  exclusión (documentada y justificada).

---

## 6. Endpoints y permisos

Convención del proyecto: `/api/v1/tenants/{tenantId:guid}/catalog/pricing/...`, CQRS vía
`ISender`, `Result<T>` y `PermissionFilters.Require`.

| Operación | Endpoint | Permiso |
|---|---|---|
| Listar listas | `GET .../price-lists` | `catalog.pricing.read` |
| Crear lista | `POST .../price-lists` | `catalog.pricing.create` |
| Editar lista | `PUT .../price-lists/{id}` | `catalog.pricing.update` |
| Desactivar lista | `DELETE .../price-lists/{id}` | `catalog.pricing.delete` |
| Precios de un ítem | `GET .../items/{itemId}/prices?listId=&date=` | `catalog.pricing.read` |
| Crear vigencia de precio | `POST .../items/{itemId}/prices` | `catalog.pricing.create` |
| Editar/cerrar vigencia | `PUT .../prices/{priceId}` | `catalog.pricing.update` |
| Desactivar precio | `DELETE .../prices/{priceId}` | `catalog.pricing.delete` |
| Historial | `GET .../items/{itemId}/prices/history?listId=&from=&to=` | `catalog.pricing.history.read` |
| Listar/crear/editar promociones | `GET/POST .../promotions`, `PUT/DELETE .../promotions/{id}` | `catalog.promotions.manage` |
| Simular/Resolver | `POST .../pricing/resolve` | `catalog.pricing.read` |

Búsqueda de precios de producto por código, código de barras (`customAttributesJson.barcode`),
nombre, categoría y lista según los filtros del listado del catálogo.

---

## 7. Migración desde `CatalogItem.BasePrice`

`BasePrice` (`numeric(18,4)`, `CatalogItem.cs`) queda como legado de transición:

1. Al activar Pricing, sembrar la lista `PUBLICO` como predeterminada por tenant y migrar cada
   `BasePrice` no nulo a `product_prices` con `valid_from` = fecha de migración y sin `valid_to`.
2. Durante la convivencia, el motor usa Pricing si existe precio; si no, cae al `BasePrice`
   (fallback explícito y solo mientras dure la transición).
3. Fase de corte: la UI de catálogo deja de capturar `basePrice` (ya desacoplado en frontend) y el
   storefront / ecommerce consumen exclusivamente el motor.
4. No borrar físicamente `base_price` sin ADR que lo autorice (compatibilidad SRI y reportes).

---

## 8. Calidad

* Tests de dominio en `tests/EcuNexo.Core.UnitTests/Pricing/` (invariantes, solapamientos,
  predeterminada única, vigencias, escalas) y de aplicación en
  `tests/EcuNexo.Business.UnitTests/Pricing/` (handlers + permisos + aislamiento de tenant).
* Purga proactiva (Regla 10) al evolucionar: eliminar capturas de precio en catálogo cuando el
  corte esté completo, sin dejar código paralelo.
