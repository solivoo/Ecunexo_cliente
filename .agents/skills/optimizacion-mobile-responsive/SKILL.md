---
name: optimizacion-mobile-responsive
description: >-
  Estándares de arquitectura UI/UX, navegación táctil y adaptabilidad responsive
  para EcuNexo (menú hamburguesa off-canvas, drawer móvil, touch targets 44px,
  formularios adaptables, DataGrids en pantallas reducidas y agregación de opciones
  para tablets y smartphones).
---

# Optimización Responsive, Menú Hamburguesa y Experiencia Móvil en EcuNexo

Esta guía establece los estándares mandatorios de experiencia de usuario (UX) y arquitectura de interfaz frontend para optimizar EcuNexo en dispositivos móviles (smartphones) y tabletas táctiles, asegurando fluidez operativa en bodega, mostrador, punto de venta y movilidad gerencial.

---

## 1. Principio Rector: "Mobile-Ready Enterprise SaaS"

> **"En pantallas reducidas (tablets y smartphones), la interfaz debe respirar: el menú lateral no debe invadir el espacio de trabajo directamente, las acciones deben agruparse ergonómicamente y cada elemento táctil debe responder sin fricción."**

Los operadores y administradores acceden frecuentemente a EcuNexo desde tabletas en bodegas (despachos, inventarios, kárdex), teléfonos en ruta (repartidores, guías de remisión) o smartphones ejecutivos (aprobación de compras, monitoreo de facturas y ventas).

---

## 2. Arquitectura de Navegación: Menú Hamburguesa & Drawer Off-Canvas

### 2.1 Comportamiento por Breakpoint

| Viewport | Ancho de Pantalla | Comportamiento del Sidebar | Control de Apertura |
| :--- | :--- | :--- | :--- |
| **Desktop / Monitores** | `> 1024px` | Visible en layout principal (ancho 260px normal, 72px colapsado) | Botón interno de colapso de glubox |
| **Tablets / Laptops chicas** | `641px - 1024px` | **Oculto off-canvas** (`transform: translateX(-100%)`) | **Botón hamburguesa** (`.app-shell__hamburger-btn`) |
| **Smartphones** | `<= 640px` | **Oculto off-canvas** con ancho máximo `85vw` | **Botón hamburguesa** (`.app-shell__hamburger-btn`) |

### 2.2 Invariantes de Implementación del Drawer

1. **Botón Hamburguesa en Cabecera (`.app-shell__hamburger-btn`):**
   - Ubicado en `.app-shell__header-start` antes del título de la vista.
   - Alterna el icono Material Symbols entre `menu` (cerrado) y `close` (abierto).
   - Posee atributos de accesibilidad `aria-expanded` y `aria-label`.
2. **Backdrop Táctil con Desenfoque (`.app-shell__mobile-backdrop`):**
   - Capa fija con `z-index: 999` y fondo semitransparente con `backdrop-filter: blur(3px)`.
   - Al hacer clic o tap sobre el backdrop, el menú se cierra instantáneamente.
3. **Cierre Automático en Navegación:**
   - Todo cambio de ruta detectado por React Router (`pathname`, `search`) debe cerrar automáticamente el drawer lateral para que el usuario aterrice directamente en el contenido seleccionado.
4. **Cierre por Teclado:**
   - La tecla `Escape` debe cerrar el drawer móvil.
5. **Drawer Expandido en Móvil:**
   - Al abrirse en viewport móvil o tablet, el sidebar SIEMPRE debe renderizarse expandido (`collapsed={false}`), mostrando los textos completos de cada módulo para que el usuario no tenga que adivinar iconos pequeños.
6. **Sin Cabeceras Redundantes en el Drawer:**
   - No añadir barras de encabezado ni botones "X" duplicados dentro del drawer (`app-shell__mobile-sidebar-header`).
   - El cierre se delega limpiamente al botón nativo de colapso de glubox (`onCollapsedChange={(next) => isMobile ? setMobileOpen(false) : setCollapsed(next)}`), al botón hamburguesa de la cabecera, al tap en el backdrop o a la navegación a cualquier módulo.

---

## 3. Patrones para Agregar Opciones y Acciones en Pantallas Móviles

Cuando diseñes o agregues nuevas opciones, botones o controles a una vista, sigue estas reglas de ergonomía móvil:

### 3.1 Agrupación de Acciones de Cabecera con `EcuPageActions`

**Regla de Oro:** NUNCA coloques 4 o 5 botones `<Button>` sueltos en el `PageHeader.actions` de una vista.

- **Usa `<EcuPageActions items={actionItems} />`:**
  - En escritorio: renderiza los botones en la barra de herramientas si hay espacio.
  - En móviles y tablets: automáticamente los agrupa en un menú desplegable contextual («Acciones...») accesible con un solo tap.
- **Evita botones duplicados (Regla 3 de EcuNexo):** Si un botón primario ya está en `PageHeader.actions`, no lo dupliques dentro de `actionItems`.

### 3.2 Tamaño Mínimo de Toque (Touch Targets: 44×44 px)

- Todo botón, enlace, pestaña (`tab`), casilla de verificación o disparador táctil debe tener un área efectiva mínima de **44×44 píxeles** (estándar WCAG 2.1 AA y Google Material Design).
- Si el icono visual es más pequeño (ej. 20px), el contenedor debe tener padding suficiente (`padding: 0.5rem` o `min-height: 2.75rem`).
- Mantén una separación mínima de **8px** entre botones adyacentes para evitar pulsaciones erróneas con el pulgar.

### 3.3 Formularios Adaptables (Grid Responsive)

- Utiliza clases CSS fluidas que colapsen automáticamente:
  - `.ecu-companies-form__grid--4`:
    - En escritorio (> 1024px): 4 columnas (`1fr 1fr 1fr 1fr`).
    - En tablet (641px - 1024px): 2 columnas (`1fr 1fr`).
    - En móvil (<= 640px): 1 columna (`1fr`).
- Los campos de texto ancho o descripciones deben usar `--span-full` o `--span-3` para estirarse ergonómicamente.

### 3.4 StatCards e Indicadores KPI

- Los `<StatCard>` DEBEN ir siempre envueltos en `<div className="ecu-stat-grid">` (Regla 2).
- En pantallas móviles, `.ecu-stat-grid` se convierte automáticamente en 1 columna o cuadrícula compacta 2×2, evitando que las tarjetas se estiren infinitamente o desborden la vista.

### 3.5 Carga de Fotografías y Archivos Táctil (Sin "Arrastrar" en Móviles)

- **Eliminación Mandatoria de "Drag & Drop" en Móvil:**
  - En smartphones y tablets **no existe mouse ni puntero** para arrastrar archivos entre ventanas del sistema operativo o escritorios.
  - Las cajas punteadas con texto *"Arrastra tus fotografías aquí"* o *"Suelta los archivos"* son frustrantes y engañosas en pantallas táctiles.
  - **Regla:** Oculta siempre la zona de arrastre en móviles y táctiles usando `@media (max-width: 768px), (pointer: coarse) { .ecu-product-gallery__dropzone { display: none !important; } }`.
- **Botones Directos de Selección y Captura con Cámara:**
  - En móviles y tablets, provee dos botones de acción táctil directos y claramente identificables:
    1. **"Tomar Foto" (`<Camera />`):** Invoca un `<input type="file" accept="image/*" capture="environment" />` dedicado que abre inmediatamente la cámara trasera/de producto del dispositivo sin pasar por menús intermediarios. En entornos de escritorio con soporte WebRTC seguro (`getUserMedia`), abre el modal con visor en vivo (`CameraCaptureModal`).
    2. **"Añadir Fotos" (`<Upload />`):** Abre la galería o selector de archivos de imágenes múltiples (`multiple accept=".jpg,.jpeg,.png,.webp,image/*"`).
- **Gestión Previa Visual:**
  - Muestra miniaturas cuadradas 1:1, badge de "Portada", indicador de orden y botones de acción táctiles (quitar, mover orden, zoom).

### 3.6 Tablas y Grillas de Datos (DataGrid) en Móvil: Patrón `renderCard`

En glubox `DataGrid`, cuando el layout es `auto` o `card` (pantallas `<= cardBreakpoint`, recomendado `768px`), NUNCA confíes en el renderizador por defecto de tarjetas (que genera una lista de pares clave-valor plana y poco atractiva).

**Estándar de Tarjetas Elegantes para Móviles (`renderCard`):**
1. **Prop `renderCard` dedicada:** Provee siempre una función memoizada `renderCard: ({ row }) => ReactNode`.
2. **Jerarquía Visual Clara:**
   - **Encabezado:** Foto/miniatura visual (60×60px con fallback estilizado), título destacado en negrita (máximo 2 líneas clamp), badge de categoría superior y badge de estado con dot (`StatusBadge`).
   - **Metadatos y Etiquetas:** SKU en bloque de código (`<code className="ecu-code">`), tipo de ítem (`Físico` / `Servicio`).
   - **Cuerpo / Barra de Precio:** Etiqueta en mayúsculas pequeñas ("PRECIO BASE") y valor numérico en tipografía destacada y color primario (`font-size: 1.25rem`, `font-weight: 800`).
   - **Acciones Táctiles Directas:** Botones táctiles de al menos 40-44px para acciones primarias (ej. botón [Editar] con icono y texto, botón [Eliminar] de peligro con detención de propagación `e.stopPropagation()`).
   - **Pie:** Fecha de alta o metadata contextual en color atenuado (`--glb-muted`).
3. **Navegación al Tap:** Configura `onCardSelect={(row) => navigate(...) }` en el `<DataGrid>` para que al pulsar la tarjeta completa se acceda naturalmente al detalle o edición del registro.
4. **Soporte Dark Mode:** Asegura fondos de tarjeta `var(--glb-surface)`, bordes sutiles `var(--shell-border)` y sombras M3 suaves.
5. **Desbloqueo Mandatorio de Scroll Táctil (`overscroll-behavior: auto`):**
   - Glubox aplica internamente `overscroll-behavior: contain` y `overflow: auto; height: 100%` en `.glb-datagrid__scroll--cards` y `.glb-datagrid__viewport { overflow: hidden }`.
   - En pantallas táctiles (tablets y smartphones), esto **atrapa el gesto de deslizamiento con el dedo**, impidiendo que el usuario haga scroll vertical sobre la grilla o tarjetas para bajar en la página.
   - **Regla:** Mantén siempre sobreescrito en los estilos globales (`ecu-companies-form.css` o CSS del módulo):
     ```css
     .glb-datagrid--card-layout .glb-datagrid__viewport { overflow: visible !important; height: auto !important; }
     .glb-datagrid--card-layout .glb-datagrid__scroll--cards { overflow: visible !important; height: auto !important; overscroll-behavior: auto !important; touch-action: pan-y !important; -webkit-overflow-scrolling: touch; }
     .glb-datagrid--card-layout .glb-datagrid__cards, .glb-datagrid--card-layout .glb-datagrid__card { touch-action: pan-y !important; }
     ```
   - Para modo tabla sin virtualización de altura fija: `.glb-datagrid__scroll { overflow-x: auto !important; overflow-y: visible !important; overscroll-behavior-y: auto !important; touch-action: pan-x pan-y !important; }`.

### 3.7 Vistas Dedicadas sobre Modales en Móviles (Regla 9)

- Los formularios de 3 o más campos NUNCA deben encapsularse en un `<Popup>` modal en móvil:
  - El teclado virtual del teléfono tapa los campos inferiores y el botón de guardar.
  - Al hacer scroll se arrastra el fondo y se pierde el foco.
- Construye siempre páginas dedicadas (`/entidad/nueva`, `/entidad/:id`), donde el usuario disfruta de scroll vertical nativo fluido y sin claustrofobia.

---

## 4. Checklist para Nuevas Vistas y Opciones en Móviles

Antes de dar por concluida una tarea de UI:
- [ ] ¿El sidebar se oculta por defecto en tablet y smartphone y abre fluidamente con el botón hamburguesa?
- [ ] ¿El drawer se cierra al hacer tap en el backdrop o al cambiar de página?
- [ ] ¿Se eliminó la opción y texto de "arrastrar archivos" en móviles, usando botones táctiles directos?
- [ ] ¿El selector de archivos en móvil permite abrir la cámara o la galería fotográfica (`accept="image/*"`)?
- [ ] ¿Los botones y campos tienen un área táctil cómoda de al menos 44px?
- [ ] ¿El formulario colapsa a 1 o 2 columnas sin desbordar el viewport horizontal?
- [ ] ¿Las acciones de la cabecera utilizan `EcuPageActions` para no apiñar botones en móvil?
- [ ] ¿No existe scroll horizontal indeseado en la pantalla (`overflow-x: hidden` en el viewport)?
