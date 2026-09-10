---
name: glubox-enterprise-ui
description: >-
  Use this skill whenever designing, building, or refactoring UI components, pages, dashboards,
  forms, or tables in the frontend. Combines Google Material Design 3 surface layering,
  modern enterprise SaaS layout patterns (PageHeader, KPI StatCards, SectionCards, Toolbars),
  and glubox component integration.
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
│  │ SectionCard con Header (Búsqueda + Filtros rápidos + DataGrid)    │ │
│  │                                                                   │ │
│  │  <DataGrid ... />   o   <EmptyState ... />                        │ │
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

### 3.5. DataGrid Toolbar
Las tablas `glubox` deben estar acompañadas de una barra superior consistente:
- Campo de búsqueda instantánea (`TextBox` con icono de lupa).
- Selector de fechas (`RangeDateBox`) si hay registros temporales.
- Filtros por estado o categoría (`Select` o Chips).
- Acciones rápidas (Refrescar, Exportar CSV/PDF, Acciones en lote).

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
- **Compatibilidad**:
  - Soporte total para modo oscuro (`html.sf-dark-mode`) con contraste elevado y bordes sutiles.
  - Sincronización completa con la suite de pruebas automatizadas Playwright E2E (`tests-ui/`).

### v0.1.0 — Arquitectura Base
- Integración de `glubox` básico con componentes atómicos iniciales.
- Rutas base y esquemas de autenticación y navegación.
