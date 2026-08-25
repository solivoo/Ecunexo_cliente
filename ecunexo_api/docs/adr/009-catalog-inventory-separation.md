# ADR-009 — Separación Catálogo (maestro) vs Inventario (transaccional)

**Estado:** Aceptado  
**Fecha:** 2026-06-13

## Contexto

EcuNexo debe servir tanto a **empresas de servicios** (catálogo de ítems intangibles, sin stock) como a **operadores con bodegas** (stock físico). Mezclar ambos conceptos en una sola entidad «producto con cantidad» genera acoplamiento, violaciones de integridad y planes SaaS incoherentes.

## Decisión

### 1. Catálogo = maestro (independiente)

- Bounded context **Catalog** define **qué** existe en el tenant.
- Cada ítem del catálogo tiene `item_kind`:
  - **`physical`** — puede existir en bodegas (microcontroladores, monitores, repuestos).
  - **`service`** — intangible (mantenimiento preventivo, diagnóstico de red, horas técnicas).
- El catálogo **no** almacena cantidades ni ubicaciones.

### 2. Inventario = transaccional (dependiente)

- Bounded context **Inventory** define **cuánto** hay y **dónde** (vía `Stock` + `Warehouse`).
- Toda fila de stock / movimiento referencia un ítem de catálogo (`catalog_item_id` → FK obligatoria).
- **Invariante de dominio:** solo ítems con `item_kind = physical` pueden tener `Stock` o `InventoryMovement`.
- Intentar crear stock para un servicio → `Result.Failure` (`catalog.item.not_stockable`).

### 3. Warehousing

- Depende de Inventario (ubicación física). Planes sin módulo `inventory` tampoco exponen `warehousing`.

### 4. Monetización por módulos

| Módulo producto | Rol |
|-----------------|-----|
| `identity` | Siempre incluido (usuarios, roles, permisos). |
| `catalog` | Maestro de ítems. Alcance restringido por plan (ABAC / settings). |
| `inventory` | Stock y movimientos. Solo planes operativos físicos. |
| `warehousing` | Bodegas. Requiere inventario en la práctica comercial. |
| `invoicing` | Documentos de venta (físico y/o servicio según catálogo). |

Plan **servicios** (`services-starter`): `identity` + `catalog` con `allowed_item_kinds = [service]`; **sin** `inventory` ni `warehousing`.

### 5. Autorización (RBAC + ABAC)

Orden de evaluación en `ecunexo_api` (sin cambiar ADR-006):

1. **Módulo contratado** — `IModuleEntitlementGuard` (`enabled_modules` del tenant / licencia).
2. **RBAC** — rol del usuario tiene el permiso (`IPermissionAccessGuard`).
3. **ABAC** — políticas `identity.policies` + restricciones de plan vía `sys_settings` / contexto:
   - `catalog.allowed_item_kinds` (plan servicios → solo `service`).
   - Condiciones sobre `resource.ItemKind` en permisos `catalog.*` e `inventory.*`.

## Consecuencias

- `starter-cloud` debe incluir **`catalog`** además de inventario/bodega (el inventario depende del maestro).
- Nuevo plan comercial **`services-starter`** en platform licensing.
- Modelo físico futuro: esquema `catalog` con `catalog_items` (no reutilizar `Product` sin `item_kind`).
- Seeds de permisos: prefijos `catalog.*`, `inventory.*`, `warehousing.*` alineados a `TenantModuleCodes`.

## Enlaces

- [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md)
- [ADR-006](006-permission-to-tenant-module-mapping.md)
- [ADR-010](010-inventory-kardex-documents-transit.md) — kárdex, documentos, traspasos, variantes diferidas
- [`12-policy-abac-fundamentos.md`](../12-policy-abac-fundamentos.md)
