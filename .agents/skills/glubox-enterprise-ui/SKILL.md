---
name: glubox-enterprise-ui
description: >-
  Use this skill whenever designing, building, or refactoring UI components, pages, dashboards,
  forms, or tables in the frontend. Combines Google Material Design 3 surface layering,
  modern enterprise SaaS layout patterns (PageHeader, KPI StatCards, SectionCards, Toolbars),
  glubox component integration, and the canonical DataGrid list pattern (OptionGroup +
  ecu-companies-grid toolbar like Inventory Documents).
---

# Glubox Enterprise UI & UX Design System

Esta guía define los estándares y patrones de diseño para construir interfaces empresariales modernas, atractivas y consistentes en EcuNexo utilizando la suite **`glubox`**, la jerarquía de superficies de **Google Material Design 3 (M3)** y los patrones de layout de **Enterprise SaaS (Shopify Polaris / Linear)**.

---

## 1. Filosofía de Diseño

1. **Jerarquía Visual Clara (No a las UIs "planas")**:
   - Cada pantalla debe tener un foco evidente.
   - Las páginas no deben ser un lienzo blanco infinito con una sola tabla o un par de links planos; deben organizarse en capas con **tarjetas de superficie**, **métricas clave** y **secciones temáticas**.
2. **Elevación y Superficies Tonales (Google M3)**:
   - Utilizar el sistema de capas tonales:
     - `surface`: Fondo base de la aplicación (`--glb-app-bg` / `--c-background`).
     - `surface-container`: Fondo de tarjetas principales y paneles de contenido (`--glb-surface` / `--c-surface`).
     - `surface-container-high`: Elementos interactivos destacados, popups, toolbars y modales.
   - Preferir bordes sutiles y limpios (`1px solid var(--glb-border)` con opacidad controlada) en vez de sombras oscuras o pesadas.
3. **Composición con `glubox`**:
   - `glubox` provee los átomos funcionales (`Button`, `TextBox`, `Select`, `DataGrid`, `Popup`, `Toast`, `RangeDateBox`, `Sidebar`).
   - La aplicación debe proveer la **capa de composición** (`PageHeader`, `StatCard`, `SectionCard`, `DataGridToolbar`, `EmptyState`).

---

## 2. Anatomía Estándar de una Página

Toda vista principal de la aplicación debe estructurarse siguiendo esta secuencia:

```
┌────────────────────────────────────────────────────────────────────────┐
│  PAGE HEADER                                                           │
│  [Breadcrumb]                                      [Acciones / Botones]│
│  Título Principal + Badge de Estado                (Nuevo, Exportar)   │
│  Descripción o lead contextual                                         │
├────────────────────────────────────────────────────────────────────────┤
│  METRICS / KPI STRIP (Opcional si aplica a la vista)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ Stat Card 1  │ │ Stat Card 2  │ │ Stat Card 3  │ │ Stat Card 4    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT / DATA SECTION                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ SectionCard: título + OptionGroup segmentado (cola/estado)        │ │
│  │ DataGrid ecu-companies-grid: buscar izq. + fechas/filtros der.    │ │
│  │ <EmptyState /> si no hay filas                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Patrones de Componentes

### 3.1. PageHeader
Provee orientación instantánea al usuario:
- **Título**: `h1` claro y conciso (font-weight: 700, 1.35rem a 1.6rem).
- **Badge**: Indicador de contexto o estado (`StatusBadge`: Activo, Titular, Borrador, etc.).
- **Descripción**: Subtítulo explicativo en color atenuado (`--glb-muted`).
- **Acciones**: Botones de acción principal (`<Button variant="primary">`) y secundarias alineadas a la derecha.

### 3.2. StatCard (KPIs / Métricas)
Destaca datos cuantitativos o estados clave en una cuadrícula responsiva (`grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`):
- **Icono en Contenedor Tonal**: Icono SVG/Material en un contenedor redondeado con color tonal tenue (`background: color-mix(in srgb, var(--primary) 12%, transparent)`).
- **Valor Principal**: Número o estado en grande (1.5rem, font-weight: 700).
- **Etiqueta**: Nombre de la métrica (font-size: 0.8125rem, color atenuado).
- **Tendencia o Detalle**: Badge tipo pill que muestra variación (+12%, Límite alcanzado, etc.).

### 3.3. SectionCard (Contenedores M3)
- Tarjetas con `border-radius: 14px` o `16px`.
- Fondo `var(--glb-surface)`.
- Borde sutil `1px solid var(--glb-border)` o `1px solid rgba(0, 0, 0, 0.07)`.
- En hover para tarjetas clickeables: `transform: translateY(-2px)`, micro-sombra difusa y acento de color en el borde.

### 3.4. EmptyState
Cuando una tabla o lista no contiene registros:
- NUNCA mostrar una tabla vacía sin explicación.
- Mostrar contenedor centrado con:
  1. Icono representativo en círculo suave.
  2. Título amigable (ej. "No hay empresas registradas aún").
  3. Texto explicativo de qué debe hacer el usuario.
  4. Botón de acción principal (`<Button variant="primary">Crear empresa</Button>`).

### 3.5. DataGrid / Listas — Patrón Canónico (obligatorio)

Todas las pantallas de listado con `DataGrid` deben verse y estructurarse como **Historial de Documentos Logísticos**.

**Referencia de código:** [`ecunexo_admin/src/pages/inventory/InventoryDocumentsListPage.tsx`](../../ecunexo_admin/src/pages/inventory/InventoryDocumentsListPage.tsx)

**Regla Cursor:** `.cursor/rules/enterprise-datagrid-lists.mdc` (se aplica al editar `*List*` / `*Grid*` pages).

#### Anatomía

```
┌─ SectionCard ─────────────────────────────────────────────────────────┐
│  Título + subtítulo                    [ OptionGroup segmentado ]     │
│  (ej. Activos | Todos | Inactivos)     ← cola / estado PRIMARIO       │
├───────────────────────────────────────────────────────────────────────┤
│  DataGrid  className="ecu-companies-grid"                             │
│  [🔍 Buscar……………]              [ Select tipo? ] [ Rango fechas ]     │
│  ───────────────────────────────────────────────────────────────────  │
│  | columnas…                                                    |     │
│  paginación…                                                          │
└───────────────────────────────────────────────────────────────────────┘
```

#### Checklist de implementación

1. **`SectionCard.action`**: filtros de cola/estado primario con `<OptionGroup layout="segmented" variant="outline" size={size} />` (`useGluComponentSize`). **No** usar `Select` con `label` / `labelPosition="outlined"` en el header de la card.
2. **`DataGrid`**: `className="ecu-companies-grid"` (habilita toolbar horizontal en `src/styles/ecu-companies-form.css`).
3. **Búsqueda**: `showSearch`, `searchPosition="left"`, `searchWidth={280}` (o similar), placeholder corto.
4. **`toolbarRight`**:
   - Ideal: solo `<GridDateRangeBox … />`.
   - Si hay un filtro secundario (tipo, categoría): `Select` **sin** label flotante (`aria-label=…`) + fechas, envueltos en `<div className="ecu-comprobantes-filters">` para mantener **una sola fila**.
5. **Columna Acciones** (glubox ≥ **0.1.22**): siempre última, con `sticky: 'right'` en el `ColumnDef`. No se esconde al scroll horizontal.
6. **EmptyState** dentro del mismo `SectionCard` cuando no hay filas; el `OptionGroup` del header permanece visible.

#### Anti-patrones (evitar errores de UI)

| Incorrecto | Por qué falla | Correcto |
|---|---|---|
| `Select` “Mostrar” outlined en `SectionCard.action` | Label flotante + desalineado vs tabs | `OptionGroup` segmentado |
| Filtros en franja aparte encima del grid | Duplica toolbar; se ve “otro módulo” | Todo en header + `toolbarRight` |
| Varios `Select` apilados en `toolbarRight` sin `ecu-companies-grid` | Slot derecho estrecho → wrap vertical | `ecu-companies-grid` + `ecu-comprobantes-filters` |
| Clase inventada (`ecu-customers-grid`) sin CSS de toolbar | Pierde el layout canónico | `ecu-companies-grid` |
| Acciones sin `sticky: 'right'` | Se ocultan al scroll horizontal | `sticky: 'right'` en ColumnDef |

#### CSS de soporte (no reinventar)

- `.ecu-companies-grid .glb-datagrid__toolbar` / `__toolbar-right` — fila alineada, `flex-shrink: 0` a la derecha.
- `.ecu-comprobantes-filters` — flex fila + wrap controlado para varios filtros.
- `.ecu-grid-date-range` — ancho fijo del rango de fechas (~23rem).

### 3.6. Command Palette & Top Bar Global Search (`Ctrl + K` / `Cmd + K`)
Acceso rápido universal montado en el header del layout principal:
- Disparador visual en header con atajo `<kbd>Ctrl K</kbd>` (o `<kbd>⌘K</kbd>` en macOS).
- Modal flotante con fondo difuminado (`backdrop-filter: blur(8px)`).
- Búsqueda en tiempo real con normalización de acentos y sinónimos.
- Agrupamiento semántico: *Acciones Rápidas*, *Navegación* y *Sistema y Preferencias*.
- Navegación completa por teclado (`↑` / `↓` para mover selección, `↵` para ejecutar, `Esc` para salir).
- Filtrado dinámico por permisos activos de sesión (`selectVisibleNavigation` y `selectPermissions`).

### 3.7. Regla Estricta Anti-Duplicidad de Botones en PageHeader y EcuPageActions
- **Problema de diseño**: En pantallas de escritorio, `<EcuPageActions items={actionItems} />` renderiza sus ítems como botones visibles en un toolbar horizontal (`.ecu-page-actions__desktop`). Si un componente define un botón primario o destacado directamente en `PageHeader.actions` (por ejemplo: `<Button variant="primary">+ Nuevo...</Button>`, `<Button variant="outline"><Ban /> Anular Lote</Button>`, o `<Button><Download /> Descargar Informe</Button>`) y **al mismo tiempo** incluye esa misma acción dentro de `actionItems` (ej. `{ id: 'create', label: 'Nuevo...' }`, `{ id: 'cancel-batch', label: 'Anular Lote' }`), en escritorio aparecerán **dos botones repetidos e idénticos** uno al lado del otro.
- **Regla Obligatoria**:
  1. **Acción Principal o Destacada**: Renderizar como un `<Button>` independiente directamente en `PageHeader.actions` (ej. `+ Nuevo Ítem`, `Importar Lote`, `Anular Lote`, `Descargar Informe`).
  2. **`actionItems` de `EcuPageActions`**: **NUNCA** debe contener una acción que ya fue renderizada como botón directo. Solo debe incluir acciones complementarias o secundarias (ej. `Actualizar`, `Plantilla Excel`, o accesos a otros submódulos) que no cuenten con botón visible propio.
  3. Antes de agregar cualquier entrada a `actionItems`, auditar que no duplique ningún botón adyacente en el header.

---

## 4. Estándares de Color y Modo Oscuro

1. **Tokens de `glubox` y CSS Variables**:
   - Siempre usar variables CSS semánticas:
     - Primario: `var(--shell-primary)` o `var(--glb-primary)`
     - Superficie: `var(--glb-surface)`
     - Bordes: `var(--glb-border)`
     - Texto: `var(--glb-text)` / Texto secundario: `var(--glb-muted)`
2. **Modo Oscuro (`html.sf-dark-mode`)**:
   - Todas las sombras deben atenuarse o reemplazarse por bordes luminosos muy sutiles (`border: 1px solid rgba(255, 255, 255, 0.08)`).
   - No usar negros absolutos `#000000` para fondos principales; preferir tonos profundos (`#12131a`, `#1a1b24`, `#1e1f2a`).
3. **Microinteracciones**:
   - Transiciones rápidas y naturales: `transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 5. Historial de Versiones & Features

### v0.3.0 — Global Command Palette & Comprehensive UI Test Suite
- **Buscador Global & Command Palette (`Ctrl + K` / `Cmd + K`)**:
  - `CommandPaletteTrigger`: Disparador responsivo en la barra superior con detección inteligente de atajo (`⌘K` en macOS, `Ctrl K` en Linux/Windows).
  - `CommandPaletteModal`: Modal flotante con desenfoque de fondo (`backdrop-filter: blur(8px)`), auto-enfoque al abrir y navegación total por teclado (`↑↓↵ Esc`).
  - Motor de búsqueda en memoria con normalización de acentos y sinónimos para acciones rápidas, rutas autorizadas del inquilino y ajustes de apariencia.
  - Sincronización instantánea de modo claro/oscuro y copia de diagnóstico técnico para soporte.
- **Iconografía SVG Nativa (Lucide Integration)**:
  - Registro de glifos SVG nativos (`Sparkles`, `Copy`, `Info`, `LogOut`, `Sun`, `Moon`, `Check`, `FolderTree`) para evitar fallos tipográficos en ligaduras de fuentes.
  - Contención CSS con `overflow: hidden` y dimensionado estricto `width/height: 1.15rem`.
- **Suite de Pruebas Automatizadas de UI (`tests-ui/comun/`)**:
  - 71 pruebas automatizadas estructuradas en 25 archivos Playwright.
  - Cobertura completa de Enterprise Shell, Command Palette, Dashboard M3, Catálogo, Bodegas e Inventario, y Organización multi-tenant.

### v0.2.0 — Modern Enterprise SaaS & Google Material Design 3
- **Capa de Primitivos Empresariales (`src/components/ui/`)**:
  - `PageHeader`: Cabecera estandarizada con jerarquía tipográfica, badge contextual y ranura de acciones alineadas.
  - `StatCard`: Tira de métricas analíticas KPI con soporte híbrido de Google Material Symbols y SVG de Lucide, tono dinámico (`toneColor`) y subtítulo.
  - `SectionCard`: Tarjetas modulares de superficie tonal (`var(--glb-surface)`) para aislar tablas, formularios y paneles temáticos.
  - `StatusBadge`: Badges semánticos (activo, inactivo, prueba, borrador) con punto indicador luminoso (`withDot`).
  - `EmptyState`: Estados vacíos ilustrados con llamado a la acción (`action`) directo.
  - `QuickActionCard`: Accesos directos operativos para el dashboard y centros de control.
- **Rediseño Completo de Módulos (100% Cobertura)**:
  - **Dashboard**: Panel central con KPIs, accesos rápidos y estado del sistema.
  - **Equipo & RBAC (14 vistas)**: Usuarios, roles, permisos y departamentos reestructurados con layout `.ecu-dashboard-layout`.
  - **Seguridad**: Catálogo de permisos globales y políticas contextuales ABAC.
  - **Catálogo**: Productos, servicios y categorías con árbol taxonómico y moldes dinámicos.
  - **Bodegas e Inventario**: Almacenes, stock en tiempo real, documentos de inventario y Kardex.
  - **Compras & Facturación SRI**: Emisión de facturas, monitor SRI, comprobantes electrónicos y retenciones.
  - **Organización & Licenciamiento**: Cupos multi-tenant, alta/baja de empresas y suscripción.
  - **Ajustes & Preferencias**: Personalización de densidad, temas de interfaz y diagnóstico técnico.
- **Navegación & Productividad Global**:
  - **Command Palette (`Ctrl + K` / `Cmd + K`)**: Buscador modal omnipresente en el header con auto-enfoque, navegación por teclado (`↑↓↵`), ejecución instantánea de acciones directas (`+ Factura`, `+ Usuario`, `+ Bodega`), alternancia de tema claro/oscuro y salto entre rutas autorizadas.
- **Compatibilidad**:
  - Soporte total para modo oscuro (`html.sf-dark-mode`) con contraste elevado y bordes sutiles.
  - Sincronización completa con la suite de pruebas automatizadas Playwright E2E (`tests-ui/`).

### v0.1.0 — Arquitectura Base
- Integración de `glubox` básico con componentes atómicos iniciales.
- Rutas base y esquemas de autenticación y navegación.
