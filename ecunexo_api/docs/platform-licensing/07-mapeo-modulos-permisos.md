---
title: Mapeo plan → módulos → permisos
tags: [ecunexo, rbac, modulos]
---

# Mapeo plan → módulos → permisos

> Arquitectura Catálogo vs Inventario y plan **servicios**: [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md) · ADR [`009-catalog-inventory-separation.md`](../adr/009-catalog-inventory-separation.md).

## Capas

| Capa | Qué controla | Dónde |
|------|--------------|-------|
| **Plan comercial** | Precio, cupos, módulos vendidos | Panel platform |
| **Módulo producto** | Menú, endpoints | `subscription_accounts.enabled_modules` → `tenants.enabled_modules` |
| **Setting de plan** | Alcance fino del catálogo | `catalog.allowed_item_kinds` (objetivo) |
| **Permiso RBAC** | Acciones finas | `identity.permissions` + roles |
| **Política ABAC** | Condiciones sobre recurso/contexto | `identity.policies` |

## Regla v1 (onboarding actual)

Al provisionar una **empresa** bajo suscripción, el rol **Administrador** recibe todos los permisos activos del catálogo **cuyo módulo de producto esté en `enabled_modules` de la licencia** (`ModulePermissionFilter`).

El flujo **activate-license** crea primero el **titular** (plano C); las empresas y sus admins se crean con `POST /subscription/companies`.

Los **módulos** del plan limitan qué áreas tiene sentido usar (`ModuleEntitlementGuard`, menú SPA).

### Orden de autorización (tenant API)

1. `IModuleEntitlementGuard` — ¿módulo contratado?
2. RBAC — ¿rol tiene permiso?
3. ABAC — ¿política Deny/condición de plan? (doc **12**)

## Módulo → permisos típicos (referencia)

| Módulo | Permisos ejemplo | Depende de |
|--------|------------------|------------|
| identity | `identity.users.*`, `identity.roles.*`, `identity.permissions.read` | — (siempre en licencia) |
| catalog | `catalog.item.*`, `catalog.product.read` (legacy seed) | — (maestro) |
| inventory | `inventory.*` | Catálogo + ítems **physical** |
| warehousing | `warehousing.*` | Inventario (comercial) |
| invoicing | `facturacion.*` | Catálogo (ítems a facturar) |

## Plan → módulos por defecto (objetivo)

| Plan (`planCode`) | `enabled_module_codes` | Catálogo | Inventario |
|-------------------|------------------------|----------|------------|
| **`pro-independiente`** | `identity`, `catalog`, `facturacion` | Solo **service** (objetivo) | ❌ |
| `local-comercio` | + `inventory`, `warehousing` | Físico + servicio | ✅ (1 bodega) |
| `taller-mixto` | iguales a Local | Físico + servicio | ✅ (2 bodegas) |
| `empresa-pyme` | iguales | Completo | ✅ (3) |
| `cadena-retail` | iguales | Completo | ✅ (8) |
| `grupo-multi-ruc` | iguales por tenant | Completo | ✅ (10, 5 empresas) |

### Restricción plan servicios

- Sin módulos `inventory` ni `warehousing` en la licencia.
- Setting objetivo: `catalog.allowed_item_kinds = ["service"]`.
- Política ABAC opcional en `catalog.item.create`: `resource.ItemKind == "service"`.

## Evolución v2

- Resolver `catalog.allowed_item_kinds` en `ISettingsResolver` (cascada plan → tenant).
- Permisos `catalog.item.*` sustituyen gradualmente `catalog.product.*`.
- Validación de dominio: stock solo si `item_kind = physical`.

## Enlaces

- [[10-modelo-titular-suscripcion-rbac]]
- [[02-planes-y-precios-ecuador]]
- [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md)
- [`docs/adr/006-permission-to-tenant-module-mapping.md`](../adr/006-permission-to-tenant-module-mapping.md)
- [`docs/12-policy-abac-fundamentos.md`](../12-policy-abac-fundamentos.md)
