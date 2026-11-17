# Manual operativo — Alta de productos, inventario y gestión de precios

Guía paso a paso para publicar productos nuevos, registrar su costo real (con factura de proveedor o sin factura) y configurar precios de venta, escalas por volumen y promociones sin errores.

> **Contrato técnico del motor y formas SÍ/NO de crear precios:** [`20-sistema-precios-actual.md`](20-sistema-precios-actual.md). Este manual es el flujo operativo en UI.

---

## 1. Cómo se divide el negocio (4 piezas)

| Módulo | Qué guarda | Qué NO hace |
|---|---|---|
| **Catálogo** | Qué es el producto (nombre, descripción, SKU, código de barras, fotos, familia/atributos, variantes). Opcional: `cost_price` estimado si aún no ingresas mercadería. | No controla stock ni define promociones/listas. |
| **Compras** | Facturas de proveedor (XML SRI o manual), proveedores, retenciones, proformas. Al **Recibir compra** genera la entrada a bodega. | No fija el PVP de venta al público. |
| **Inventario** | Existencias por bodega y **costo promedio ponderado** (neto sin IVA). | No define el PVP ni los descuentos comerciales. |
| **Gestión de precios** | Listas de precios (`PUBLICO`, `MAYORISTA`, etc.), PVP vigentes por SKU, escalas por cantidad, promociones, cupones e historial de cambios. | No modifica existencias ni costos de bodega. |

> **Regla de oro:** el **costo** entra por *Compras* o *Inventario* (en neto sin IVA) y sirve para medir tu margen. El **precio de venta (PVP)** vive en *Gestión de precios* (con IVA incluido o neto + IVA según lo marque la lista).

---

## 2. Configuración inicial (una sola vez)

1. **Bodegas → Ubicaciones:** verifica que exista la bodega principal (despacho ecommerce).
2. **Catálogo → Atributos y Plantillas:** define tus atributos base y plantillas de familia (ej. *Calcetines*).
3. **Catálogo → Gestión de precios → Listas de precios:**
   - Crea o verifica la lista **predeterminada** (ej. `PUBLICO`, moneda `USD`, **Los precios incluyen IVA = Sí** si vendes al público con PVP final).
   - Opcional: crea `MAYORISTA` (no predeterminada) y define **Margen sugerido (%)** si quieres que al cargar precios nuevos se sugiera `costo × (1 + margen/100)`.
4. *(Opcional)* **Gestión de precios → Escalas por cantidad:** si tendrás reglas reutilizables (ej. `3–5 un.: -5%`, `6–11 un.: -10%`, `12+ un.: -15%`).

---

## 3. Flujo A — Agregar productos CON factura de proveedor (XML SRI o física)

Úsalo cuando compras mercadería formalmente y tienes el comprobante del proveedor.

### Paso 1: Crear el producto en Catálogo
1. Ve a **Catálogo → Ítems → + Nuevo ítem**.
2. Elige **Producto estándar** (SKU único) o una **Plantilla** (matriz con variantes por talla/color).
3. Completa identidad, descripción, SKU único (por cada variante), código de barras y fotos.
   - *Nota:* en producto con plantilla, la plantilla solo aporta atributos comunes y ejes; el nombre comercial es el del producto/variante.
4. Guarda. Hasta aquí el producto existe con **stock 0** y **sin PVP en `pricing`**.
   - El campo opcional **precio base** del ítem (`base_price`) **no** sustituye Gestión de precios: solo es fallback de la lista predeterminada si aún no hay `product_price`.

### Paso 2: Registrar la factura en Compras y recibir a bodega
1. Ve a **Compras → Documentos → Nueva compra** (puedes importar el **XML del SRI** o llenarla manualmente).
2. Verifica/asocia el proveedor y el número de factura (`001-001-000000123`).
3. En cada línea de la factura, enlaza el **Ítem físico / SKU** creado en el Paso 1, indica cantidad y costo unitario **neto sin IVA** (el sistema desglosa el IVA de la factura aparte).
4. Guarda la compra y haz clic en **Recibir compra** seleccionando la bodega destino.
   - Al recibir, el sistema crea y aprueba automáticamente el documento de ingreso en Inventario, suma las unidades al **Stock** y actualiza el **costo promedio** en el **Kárdex**.

### Paso 3: Fijar los precios de venta (PVP)
1. Ve a **Catálogo → Gestión de precios → Matriz de precios** (ideal para cargar o revisar varios SKUs y listas en una sola tabla).
2. Revisa la columna **Costo ref.** (tomado del kárdex) y verifica en el encabezado si la lista dice **`IVA incl.`** o **`Neto + IVA`**.
   - Si dice **`IVA incl.`** (caso normal retail `PUBLICO`): escribe el **precio final al público con IVA**.
   - Si dice **`Neto + IVA`**: escribe el valor **antes de IVA**.
3. Escribe el precio en la celda de la lista (ej. `PUBLICO` y `MAYORISTA`) y presiona `Enter`.
   - Debajo del precio verás al instante el margen (`Mg XX%` en verde o `Bajo costo` en rojo).
4. *(Opcional)* Si el producto lleva escala por volumen (ej. descuento desde 6 o 12 pares), ve a **Precios de productos**, selecciona los ítems y usa **Aplicar a seleccionados** con el esquema creado en **Escalas por cantidad**.

### Paso 4: Validar en el Simulador antes de vender
1. Ve a **Catálogo → Gestión de precios → Simulador**.
2. Selecciona la variante (SKU), cantidad `1` (y luego `6` o `12` si usas escalas) y la lista (`PUBLICO`).
3. Haz clic en **Simular** y verifica:
   - Precio de lista, descuento aplicado, precio neto, IVA desglosado, precio final y margen sobre costo promedio.

---

## 4. Flujo B — Agregar productos SIN factura (inventario inicial o ingreso manual)

Úsalo para mercadería inicial, saldos previos sin comprobante o muestras.

### Paso 1: Crear el producto en Catálogo
1. Igual que en el Flujo A (**Catálogo → Ítems → + Nuevo ítem**).
2. *(Solo si aún NO vas a ingresar stock todavía)*: si quieres tener referencia de costo mientras llega la mercadería, puedes ingresar el **Costo estimado** (`cost_price`) en el producto/variante. Cuando luego hagas una recepción de inventario, el costo promedio del kárdex tendrá prioridad.

### Paso 2: Ingresar el stock y costo por Inventario
1. Ve a **Inventario → Documentos → Nuevo Documento de Inventario**.
2. Configura la cabecera:
   - **Tipo de comprobante:** `Recepción (entrada)`
   - **Bodega:** `Principal` (o la bodega correspondiente)
   - **Origen de la recepción:** `Inventario inicial` (u otro origen interno sin factura)
3. En **Detalle de Artículos**, agrega cada **SKU / variante** (puedes buscar, escanear o importar por Excel/matriz):
   - **Cantidad:** unidades reales que entran.
   - **Costo unitario (neto sin IVA):** costo real de compra sin IVA (solo ingresa `0.00` si es muestra/regalo sin valor).
4. Haz clic en **APROBAR** (no basta con *Guardar* borrador: solo al aprobar entra al stock y al kárdex).

### Paso 3 y Paso 4: Fijar precios y Simular
1. Idénticos al Flujo A: **Matriz de precios** (verás **Costo ref. · Kárdex** y el margen) → **Simulador**.

---

## 5. Cómo elegir entre las pantallas de Gestión de precios

| Necesidad | Pantalla a usar |
|---|---|
| Crear listas (`PUBLICO`, `MAYORISTA`), moneda e IVA incluido | **Listas de precios** |
| Poner o ajustar precios rápidamente viendo costo ref. y margen en varias listas | **Matriz de precios** |
| Poner precio a 1 producto con **tramos manuales propios** o renovar vigencia con motivo | **Precios de productos → + Nuevo Precio** (elige primero la lista, valida desglose IVA/margen neto, escala única y usa **Guardar y simular**) |
| Cargar un lote puntual de precios nuevos con **fecha de vigencia y motivo único** | **Precios de productos → Carga por lote** |
| Crear descuentos reutilizables por volumen (`12+ un. -10%`) | **Escalas por cantidad** |
| Asignar una escala por volumen a muchos productos a la vez | **Precios de productos** (seleccionar filas → aplicar escala) |
| Crear descuentos por campaña / fechas o cupones con código | **Promociones** |
| Ver quién cambió un precio y cuándo | **Historial** |
| Comprobar cuánto pagará el cliente con IVA, escalas y promos | **Simulador** |

---

## 6. Reglas importantes para no confundirse

1. **Dos formas de escala por cantidad (no mezclarlas):**
   - **Escalas por cantidad (esquema reutilizable):** descuento en `%`, `$` o precio fijo por tramo que se reutiliza en varios SKUs.
   - **Tramos manuales (dentro de un precio puntual):** precio unitario fijo exclusivo para ese producto.
   - **Precedencia:** si un producto tiene al menos un **tramo manual** activo, ese reemplaza al esquema reutilizable.
2. **Promociones vs Escalas:**
   - Una **escala** premia la cantidad siempre que esté asignada al precio.
   - Una **promoción** es temporal (fechas) o usa **cupón** (`Requiere código promocional`) y puede ser acumulable o exclusiva según su **Prioridad**.
   - Si creas una promoción para toda la tienda usa alcance **Toda la tienda (`*`)** y asegúrate de dejarla **Activa** dentro de su rango de fechas.
3. **Variantes vs Padre de matriz:**
   - En productos con matriz (tallas/colores), carga **stock y precios en cada variante (SKU vendible)**. El precio solo en el padre se hereda, pero no es el diseño recomendado.
4. **No dar por terminado el alta** dejando solo `base_price` / “precio base” en Catálogo: el PVP oficial se crea en **Gestión de precios**.
5. **Checklist antes de revisar en la tienda (Everchic):**
   - [ ] Producto y variantes en estado **Activo** y no ocultos de vitrina.
   - [ ] Stock aprobado (`> 0`) en bodega principal (si la tienda controla existencias).
   - [ ] Precio vigente en la lista predeterminada (`PUBLICO`) para cada variante (`pricing.product_prices`).
   - [ ] Probado en **Simulador** con cantidad `1` (y mayor cantidad si tiene escala).
