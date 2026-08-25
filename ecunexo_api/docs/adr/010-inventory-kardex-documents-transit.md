# ADR-010 — Variantes diferidas, kárdex, documentos y traspasos con bodega en tránsito

**Estado:** Aceptado  
**Fecha:** 2026-08-20

## Contexto

ADR-009 separa Catálogo (qué), Inventario (cuánto) y Warehousing (dónde), pero deja abiertas decisiones de implementación que bloquean el diseño físico y el MVP:

1. ¿Modelar **variantes** (talla/color) desde el día 1?
2. ¿Cómo registrar la **verdad histórica** del stock (kárdex) sin UPDATE/DELETE?
3. ¿Cómo escalar procesos de **aprobación** (emprendedor solo vs empresa con supervisor)?
4. ¿Cómo hacer **traspasos** entre bodegas sin que los saldos “desaparezcan”?
5. ¿Cómo servir ropa, abarrotes y servicios con la **misma** base sin tablas por sector?

La intención de producto es un SaaS mantenible y a prueba de futuro: módulos desacoplados (`catalog`, `warehousing`, `inventory`, `billing`, `identity`), PostgreSQL, atributos dinámicos y reglas que se adaptan al cliente.

## Decisión

### 1. Trinidad de almacenamiento (reafirma ADR-009)

| Pieza | Pregunta | Bounded context | Módulo licencia |
|-------|----------|-----------------|-----------------|
| Catálogo | Qué | Catalog | `catalog` |
| Bodega | Dónde | Warehousing | `warehousing` |
| Inventario | Cuánto | Inventory | `inventory` |

- Catálogo es **transversal**: facturación y otros consumidores lo usan sin depender de stock.
- Warehousing e Inventory son el **módulo operativo** comercial; en código siguen siendo **dos BC** (límites de plan / permisos distintos).

### 2. Variantes: diferidas

- **MVP (fases 1–3):** un `CatalogItem` físico = un SKU / una unidad de stock.
- Atributos tipo talla/color/lote van en **`custom_attributes` (jsonb)** + molde `CategoryTemplate`, no en tabla `ProductVariant`.
- **Variantes como entidad** (SKU hijo, stock por variante) quedan para **fase 5**, cuando el mercado lo exija.
- Motivo: bajar complejidad del primer kárdex y de la UI sin cerrar la puerta a retail de moda.

### 3. Atributos dinámicos (SaaS multi-rubro)

- Esquema fijo indexado: `tenant_id`, `name`, `item_kind`, `sku` (físicos), precios, estado.
- Columna **jsonb** para atributos específicos del rubro.
- El frontend renderiza formularios leyendo el **molde** (`CategoryTemplate`) en BD.
- Filtros WHERE profundos sobre jsonb solo con índices GIN **selectivos** (atributos marcados filtrables), nunca sobre el blob completo por defecto.

### 4. Kárdex = verdad append-only

- Tabla de movimientos (`InventoryMovement` / kárdex): **solo INSERT**. Prohibido UPDATE/DELETE de filas históricas.
- Granularidad: **ítem de catálogo (o SKU MVP) + bodega**.
- Cada fila: timestamp, warehouse, catalog item, cantidad (+/−), costo unitario opcional, referencia a documento, usuario.
- El saldo actual vive en **`Stock`** (proyección). El kárdex **no** es la fuente de listados de “cuánto hay ahora”.
- Correcciones: nuevo movimiento de **reversión / ajuste**, nunca editar el pasado.

### 5. Documentos logísticos + máquina de estados

Flujos (recepción, egreso, transferencia, ajuste) parten de un `InventoryDocument`:

```
Draft → PendingApproval → Approved
              ↘ Cancelled
```

- Transiciones autorizadas con el pipeline existente: módulo contratado → RBAC → ABAC (`identity`).
- Emprendedor solo: puede auto-aprobar (policy/permiso).
- Empresa: bodeguero crea; supervisor aprueba.
- **El kárdex y `Stock` solo se afectan al pasar a `Approved`.**
- Cancelar un documento ya aprobado exige un documento/movimiento de reversión.

### 6. Traspasos: dos movimientos + bodega en tránsito

Al aprobar una transferencia A → B:

1. OUT en bodega origen (kárdex).
2. IN en bodega lógica **En tránsito** (del tenant).
3. Al confirmar recepción: OUT tránsito + IN destino.

Así los números siempre cuadran (nada “en el aire”). La bodega en tránsito es de sistema (`IsSystem` / no eliminable); se provisiona con el módulo warehousing.

### 7. Host y desacoplo

- Catalog / Warehousing / Inventory viven en **`ecunexo_api`** (mismas capas Core/Business/Data/Api).
- No microservicio de inventario en MVP.
- Integración con `Billing.Api`: referencia por `catalog_item_id` + **snapshot** en línea de factura; egreso post-autorización vía evento/outbox idempotente (fase 4).

## Consecuencias

- Modelo físico inicial **sin** `product_variants`; stock PK sobre `(tenant_id, catalog_item_id, warehouse_id)`.
- Seed: bodega principal + bodega “En tránsito” al habilitar warehousing.
- Tests de dominio obligatorios: no stock en `service`; no cantidad negativa; approve escribe kárdex; transferencia conserva suma entre origen+tránsito+destino.
- Roadmap: fases 1–2 sin documentos complejos; fase 3 transferencias + tránsito; fase 5 variantes si hay demanda.
- Documentación de plan: [`Catalogo e inventario.md`](../../../Catalogo%20e%20inventario.md) en la raíz del monorepo.

## Alternativas rechazadas

| Alternativa | Por qué no |
|-------------|------------|
| Variantes desde día 1 | Retrasa MVP; jsonb cubre atributos descriptivos |
| Solo “cantidad reservada” sin bodega tránsito | Más difícil de auditar; kárdex menos explícito |
| UPDATE del saldo sin kárdex | Pierde trazabilidad (“cómo llegué aquí”) |
| FK fuerte Billing → catalog cross-host | Acopla APIs; preferir snapshot |

## Enlaces

- [ADR-009](009-catalog-inventory-separation.md)
- [`15-catalogo-vs-inventario-y-planes.md`](../15-catalogo-vs-inventario-y-planes.md)
- [ADR-006](006-permission-to-tenant-module-mapping.md)
- Plan de bases: `/Catalogo e inventario.md` (raíz monorepo)
