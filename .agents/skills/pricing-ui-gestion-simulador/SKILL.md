---
name: pricing-ui-gestion-simulador
description: >-
  Estándares de interfaz para la Gestión de Precios en ecunexo_admin: menú, rutas, listas de
  precios, precios por producto con vigencia, promociones, historial y simulador. Patrones de
  PageHeader/DataGrid/SectionCard, permisos UI, servicios API y pruebas Playwright en EcuNexo.
---

# UI de Gestión de Precios: Pantallas y Simulador

Aplica los estándares transversales `glubox-enterprise-ui`, `ui-vistas-sobre-modales`,
`ui-compacta-sin-tutoriales` y `optimizacion-mobile-responsive`. Este documento define el layout
del módulo y sus reglas específicas. El dominio y el motor están en
`pricing-listas-precios-vigencias` y `pricing-engine-resolucion-precios`.

---

## 1. Regla de oro de la UI de precios

La interfaz **no calcula precios**. Todo desglose (lista, escala, promoción, descuento, impuesto,
precio final) proviene de `POST /catalog/pricing/resolve` del mismo `IPricingService` que usa
ventas. El simulador solo pinta la respuesta. Prohibido duplicar fórmulas en TypeScript.

---

## 2. Menú y rutas

El menú se sirve desde el backend (`session.navigation`) y se declara en
`ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs` (lista `MenuItems`), con espejo en
`ecunexo_api/src/EcuNexo.Business/Platform/Navigation/navigation.v1.json`.

Nuevo grupo hijo del padre `catalog` (label comercial **«Gestión de precios»**), visible con el
módulo `catalog` y el permiso `catalog.pricing.read`; Promociones con `catalog.promotions.manage`.

| Ruta frontend | Vista | Archivo |
|---|---|---|
| `catalogo/precios` | Redirección a `catalogo/precios/listas` | `routes.tsx` |
| `catalogo/precios/listas` | Listado de listas | `src/pages/catalog/pricing/PriceListsListPage.tsx` |
| `catalogo/precios/listas/nueva` | Alta de lista | `PriceListFormPage.tsx` |
| `catalogo/precios/listas/:priceListId` | Edición de lista | `PriceListFormPage.tsx` |
| `catalogo/precios/productos` | Precios por producto | `ProductPricesListPage.tsx` |
| `catalogo/precios/productos/nuevo` | Nueva vigencia de precio | `ProductPriceFormPage.tsx` |
| `catalogo/precios/productos/:priceId` | Editar/cerrar vigencia | `ProductPriceFormPage.tsx` |
| `catalogo/precios/promociones` | Listado de promociones | `PromotionsListPage.tsx` |
| `catalogo/precios/promociones/nueva` | Alta de promoción | `PromotionFormPage.tsx` |
| `catalogo/precios/promociones/:promotionId` | Edición de promoción | `PromotionFormPage.tsx` |
| `catalogo/precios/historial` | Historial de cambios de precio | `PriceHistoryPage.tsx` |
| `catalogo/precios/simulador` | Simulador de precios | `PriceSimulatorPage.tsx` |

Registrar en `src/router/routes.tsx` bajo el patrón del catálogo (`catalogo/items...`) y añadir
títulos de página en `src/lib/getPageTitle.ts` si la ruta lleva parámetro.

---

## 3. Patrón de páginas (reutilizar, no inventar)

Toda página sigue el estándar de `src/pages/inventory/InventoryDocumentsListPage.tsx`:

```text
div.ecu-dashboard-layout.ecu-section-page
├─ PageHeader (título, lead corto, acciones primarias)
├─ div.ecu-stat-grid + StatCard (métricas del listado)
└─ SectionCard
   └─ DataGrid className="ecu-companies-grid"
      ├─ toolbarRight: filtros + GridToolbarRefresh + acción primaria
      ├─ useGluDataGridPaging (paginación cliente)
      └─ columnas con .ecu-status / .ecu-chip / .ecu-code / formatDate
```

* Guard de permiso con `useHasPermission('catalog.pricing.read')` + `TenantSessionGate`; sin
  permiso se muestra «Acceso Restringido» (nunca pantalla en blanco).
* Acciones primarias como `<Button>` en `PageHeader.actions`; **no** duplicarlas en
  `EcuPageActions` (Regla 3 de `glubox-enterprise-ui`).
* Confirmaciones de borrado/desactivación con `Popup`; formularios con 3+ campos como vista
  dedicada (`/nueva`, `/:id`).
* Errores: `readApiError` + `toast.show`; vacíos con `EmptyState`; carga con `PageLoadState`.

---

## 4. Pantallas

### 4.1 Listas de precios
Columnas: Código (`ecu-code`), Nombre, Moneda, IVA incluido (Sí/No), Vigencia, Prioridad,
Predeterminada (`StatusBadge`), Estado. Filtros: estado, predeterminada, texto. Acciones:
editar, desactivar (bloqueada si es la predeterminada activa).

### 4.2 Precios de productos
Buscador por **código, código de barras, nombre, categoría y lista** (filtros con `Select` de
listas y categorías + `TextBox` de búsqueda). Columnas mínimas: Producto, Lista, Precio,
Desde, Hasta (`—` si indefinido), Estado. Acción «Nueva vigencia» siempre visible; editar solo la
vigencia vigente/futura.
Formulario de precio: producto (buscador con SKU/barras), lista, precio (`NumberBox`), vigencia
desde/hasta (`DateBox`), estado, motivo opcional del cambio. Al guardar un cambio de precio, el
backend cierra la vigencia anterior y crea la nueva; la UI no borra historia.

### 4.3 Promociones
Columnas: Código, Nombre, Tipo, Valor, Vigencia, Prioridad, Acumulable, Estado. Formulario con
tipo (`percentage|fixed_amount|fixed_price`), valor, fechas, prioridad, acumulable y alcance
(productos/categorías por selector múltiple). En fase 2 se ampliará el alcance a marcas,
clientes, segmentos y canales sin rediseñar la pantalla.

### 4.4 Historial de precios
Timeline/tabla append-only: fecha y hora, usuario, producto, lista, precio anterior → nuevo,
vigencia, motivo. Filtros por producto, lista y rango de fechas (`GridDateRangeBox` + `useGridDateRange`).
Solo lectura; sin acciones de edición.

### 4.5 Simulador de precios
Formulario: Producto, Lista (opcional; vacío = predeterminada), Cantidad, Fecha (`DateBox`, por
defecto hoy) y botón «Simular». Resultado en `SectionCard` con el desglose exacto del motor:

```text
Producto y lista
Precio de lista
Escala aplicada (etiqueta)     → precio unitario
Promoción aplicada             → descuento
Precio neto
Impuesto (tarifa y valor)
Precio final
Reglas aplicadas (chips)
```

Sin estado persistente ni cálculos locales; se muestra `AppliedRules` tal cual llega. Si el
resultado incluye `discardedRules`, mostrarlas como información secundaria.

---

## 5. Servicios y tipos

* `src/services/pricingApi.ts` (patrón de `catalogApi.ts` / `inventoryApi.ts`):
  funciones async tipadas que reciben `tenantId` y llaman a `/api/v1/tenants/{tenantId}/catalog/pricing/...`
  (`listPriceLists`, `createPriceList`, `updatePriceList`, `deactivatePriceList`,
  `listProductPrices`, `createProductPrice`, `updateProductPrice`, `deactivateProductPrice`,
  `listPriceHistory`, `listPromotions`, `createPromotion`, `updatePromotion`, `resolvePrice`).
* DTOs en `src/types/pricingApi.ts` espejo de los records del backend.
* Errores con `readApiError`; toasts con `useToast`; sin react-query (el proyecto usa
  `useState` + `useCallback` + `useEffect`).
* La empresa activa sale de la sesión (`selectTenantId`); nunca enviar tenant manual.

---

## 6. Permisos en la UI

| Pantalla | Permiso |
|---|---|
| Listas y simulador | `catalog.pricing.read` |
| Alta/edición de listas y precios | `catalog.pricing.create` / `catalog.pricing.update` |
| Desactivar | `catalog.pricing.delete` |
| Historial | `catalog.pricing.history.read` |
| Promociones | `catalog.promotions.manage` |

Los botones se ocultan/deshabilitan según `useHasPermission`; el backend igualmente valida.

---

## 7. Validaciones de UI

* Precio no negativo, cantidad positiva, vigencia coherente (`hasta >= desde`) y sin solapes
  advertidos por el backend (`catalog.pricing.price.overlap`, `catalog.pricing.tier.overlap`).
* Mostrar errores de dominio legibles, no stack traces.
* No permitir editar precios de otra empresa aunque llegue un id manipulado.
* Formularios con `noValidate` y validación manual en submit, como el resto de la app.

---

## 8. Pruebas

* Playwright en `tests-ui/comun/pricing-ui.spec.ts` siguiendo `catalogo-ui.spec.ts`:
  login, `test.skip(!hasRoute(session.routes, '/catalogo/precios'))`, aserciones de `PageHeader`,
  alta de lista, alta de precio con vigencia y simulación con desglose.
* Si el módulo depende del plan, actualizar `tests-ui/helpers/planMatrix.ts` (`routesForPlan`).
* Capturas claro/oscuro/móvil en `/tmp/opencode` para QA visual (no versionadas), según práctica
  del proyecto.
