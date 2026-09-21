# Catálogo, Inventario y Ecommerce — Guía Funcional

> Cómo funciona el maestro de productos de EcuNexo, cómo se ingresan distintos tipos de artículos
> usando **plantillas (arquetipos)**, y cómo eso se conecta con el inventario físico y la tienda online.

---

## 1. El modelo en 30 segundos

EcuNexo separa tres responsabilidades (ADR-009):

```
CATÁLOGO (¿qué vendo?)          INVENTARIO (¿cuánto tengo y dónde?)      ECOMMERCE (¿cómo lo vendo online?)
─────────────────────────       ─────────────────────────────────        ──────────────────────────────────
Producto + Variante (SKU)  ──►  Stock por bodega + Kárdex valorado  ◄──  Pedidos, reservas y despacho
Categoría, atributos, fotos     Documentos de ingreso/egreso/traspaso    Factura SRI + courier
```

* **Catálogo:** definición comercial. Un servicio nunca tiene stock; un producto físico existe en el catálogo y recién en inventario adquiere cantidades.
* **Inventario:** existencias por bodega, cantidad reservada (para e-commerce y talleres) y costo promedio ponderado.
* **Ecommerce:** pedidos que reservan stock al crearse, lo liberan al cancelarse y lo consumen al despacharse.

---

## 2. Las piezas del catálogo

| Pieza | Dónde se administra | Para qué sirve |
|---|---|---|
| **Categoría** | Catálogo | Clasificar y reportar (Deportivas → Calcetines). No impone campos obligatorios |
| **Diccionario de Atributos** | Catálogo → Atributos | Definir atributos y escalas reutilizables: valores, tipo de dato, si generan variantes, unidad |
| **Plantilla / Arquetipo** | Catálogo → Plantillas | Diseñar la "forma" del producto: niveles, atributos por nivel, color y dónde se capturan las fotos |
| **Producto (modelo)** | Catálogo → Ítems | Ficha comercial: nombre, categoría, atributos del modelo, ruta jerárquica, fotos del modelo |
| **Variante (SKU)** | Dentro del producto | Unidad vendible e inventariable: SKU, código de barras, precio, stock, fotos propias o heredadas |

### 2.1 Diccionario de atributos (tipado)

Cada atributo del diccionario declara:

| Campo | Valores | Efecto |
|---|---|---|
| **Tipo de dato** | Texto · Número · Sí/No · Color | Decide el control de captura (input, NumberBox, selector, ColorPicker) |
| **Uso en variantes** | Genera variantes con SKU · Solo descriptivo | Si es "solo descriptivo", el atributo no crea combinaciones ni SKUs (ej. un color único del modelo) |
| **Unidad** | ej. `cm`, `mm`, `g` | Se muestra junto al valor para capturar medidas |
| **Valores predefinidos** | Lista | Alimenta los selectores y normaliza la escritura |

### 2.2 Plantilla / Arquetipo

Una plantilla es una lista ordenada de **niveles**. Los niveles intermedios describen el modelo; el **último nivel** define las variaciones físicas (SKUs).

```
Nivel 1 — Colección / Familia   ──►  atributos del modelo (Marca, Material…)
Nivel 2 — Modelo / Estilo       ──►  atributos del modelo (Tipo, Acabado…)
Nivel 3 — Variantes Físicas     ──►  Caña × Talla × Color  → un SKU por combinación
```

Cada nivel declara además:

* **Lleva Colores:** habilita el ColorPicker en ese nivel o en las variantes.
* **Fotografías:** dónde se capturan:
  * `Sin fotos`
  * `Por variante (SKU)` → cada SKU sube la suya.
  * `Compartidas por grupo` → se sube **una vez por valor de la dimensión principal** (ej. una por color/caña) y las tallas la heredan.
  * `Del modelo (todas las variantes)` → se sube una vez en el producto y **todas** las variantes la heredan, sin duplicar archivos.

> La plantilla es el molde del **alta**. No reestructura productos ya creados: cada producto conserva sus dimensiones, SKUs, precios y stock.

---

## 3. Cómo funciona el ingreso de un producto (flujo general)

1. **Preparar el diccionario** (una sola vez): crear atributos como *Marca*, *Material*, *Caña*, *Talla*, *Medida*, *Color* con sus valores.
2. **Crear la plantilla** en Catálogo → Plantillas: niveles, atributos por nivel y alcance de fotografías.
3. **Alta del ítem** en Catálogo → Ítems → Nuevo:
   1. Elegir la plantilla (el formulario se guía solo).
   2. Completar los **Atributos del Modelo** (nivel 1/2) — se guardan en la ruta jerárquica del producto.
   3. En el constructor de **Variantes**: seleccionar valores por dimensión. Las tarjetas se agrupan por el primer eje (color si existe; si no, el primero del nivel terminal).
   4. Escribir el **SKU manual** de cada variante (no se autogenera) y, opcionalmente, código de barras, precio propio, tags y **stock inicial por bodega**.
   5. Subir fotografías según el alcance definido (modelo, grupo o variante).
4. **Guardar**: se crea el producto matriz + sus variantes, cada una con su SKU.
5. **Inventario / Ecommerce**: el stock entra por el alta (stock inicial), por documentos de ingreso (compras/ajustes) o traspasos; la tienda online ya puede vender el SKU.

---

## 4. Ejemplos de ingreso por tipo de producto

### A. Calcetines deportivos — Caña × Talla

**Diccionario**

| Atributo | Tipo de dato | Uso en variantes | Valores |
|---|---|---|---|
| Marca | Texto | Solo descriptivo | Nike, Adidas… |
| Material | Texto | Solo descriptivo | Algodón, Algodón peinado… |
| Caña | Texto | Genera variantes | Corta, Mediana, Larga |
| Talla | Texto | Genera variantes | 35-38, 39-41, 42-44 |
| Actividad | Texto | Solo descriptivo | Running, Skater, Crossfit |

**Plantilla «Calcetines Deportivos»**

| Nivel | Atributos | Fotografías |
|---|---|---|
| Colección / Familia | Marca, Material | — |
| Variantes Físicas | Caña, Talla | Compartidas por grupo (una foto por caña) |

**Resultado:** tarjetas por **Caña**; dentro, filas por **Talla**.

| Tarjeta | SKU (manual) | Foto |
|---|---|---|
| Caña corta | `NIK-001-0001`, `NIK-001-0002`, `NIK-001-0003` | 1 foto de la caña corta, heredada por las 3 tallas |
| Caña mediana | `NIK-001-0004`… | 1 foto de la caña mediana |
| Caña larga | `NIK-001-0007`… | 1 foto de la caña larga |

> Si prefieres una sola foto para todo el producto, el nivel de modelo se marca como **Del modelo**: subes 1 imagen y las 9 variantes la heredan.

> **Colores combinados (SKU bicolor):** dentro de una tarjeta puedes combinar el color principal con **colores secundarios** (ej. Negro + Blanco). El SKU se escribe manual y el título se compone como «Negro / Blanco / Talla»; los secundarios se guardan en el atributo `colores_secundarios` de la variante y no alteran la agrupación ni la herencia de fotos del color principal.

### B. Camisetas — Color × Talla

* **Plantilla:** Colección (Marca, Material) → Variantes (Color, Talla).
* **Fotografías:** *Compartidas por grupo* → una sesión de fotos por color.
* **Resultado:** tarjetas por color (Negro, Blanco, Azul…) con tallas S–XXL dentro; SKU manual por talla.

### C. Ferretería — Medida numérica con unidad

| Atributo | Tipo de dato | Unidad | Uso en variantes | Valores |
|---|---|---|---|---|
| Material | Texto | — | Solo descriptivo | Acero inoxidable, Bronce |
| Medida | Número | mm | Genera variantes | 6, 8, 10, 12 |
| Acabado | Texto | — | Solo descriptivo | Zincado, Natural |

* El **tipo de dato Número + unidad** hace que la captura sea numérica y muestre `Medida (mm)`.
* Si un producto tiene un solo acabado, ese atributo queda como *Solo descriptivo* y **no genera SKUs extra**.

### D. Producto simple — Taza

* Sin plantilla o con un nivel único. No hay variantes: un solo SKU (puede ser físico con stock o servicio).
* Fotografías: en el producto (modelo).
* Ideal para catálogos pequeños: se ingresa en modo manual libre.

### E. Servicio — Consultoría

* Tipo **Servicio**: no genera stock ni kárdex, no exige SKU, y se factura directo.
* Puede usar una plantilla solo para clasificar y describir (atributos del modelo).

### F. Variante con código de barras y stock inicial

* En cada fila de variante se registra **SKU manual**, **código de barras (EAN/UPC)** y **stock inicial + bodega**.
* El stock inicial crea el saldo en la bodega elegida; a partir de ahí todo movimiento pasa por documentos de inventario.

---

## 5. Cómo entra al inventario

| Vía | Documento / acción | Efecto |
|---|---|---|
| Alta con stock inicial | Constructor de variantes (bodega + cantidad) | Crea el saldo en la bodega |
| Compra a proveedor | Recepción de compra → **Ingreso** | Sube stock y recalcula costo promedio |
| Inventario físico | **Ajuste** (cantidad contada) | Ajusta el delta contra el saldo |
| Mover entre bodegas | **Traspaso** (Borrador → En tránsito → Recibido) | Baja en origen, sube en destino |
| Venta facturada | **Egreso** desde facturación | Baja stock y asienta costo en kárdex |

**Saldo por bodega:** `Disponible = Cantidad − Reservada`. La cantidad reservada la consumen pedidos e-commerce y trabajos de taller. Se puede fijar **stock mínimo** para alertas.

**Kárdex valorado (promedio ponderado):**

```
Nuevo costo = ((Stock anterior × Costo anterior) + (Cantidad ingresada × Costo unitario)) / Stock resultante
```

* Las salidas se valoran al costo promedio vigente.
* Los documentos aprobados son inmutables: se corrigen con una contrapartida, no editando.

---

## 6. Cómo se conecta con Ecommerce

```
Pedido creado (Placed)      → RESERVA stock (Disponible baja, físico intacto)
Pago confirmado (Confirmed) → listo para preparación
En preparación (Processing) → picking & packing
Despachado (Shipped)        → libera reserva + EGRESO definitivo en kárdex + nº de guía
Entregado (Delivered)       → cierre
Cancelado (Cancelled)       → libera la reserva al instante
```

* La tienda siempre consulta **Disponible** (evita sobreventa en compras simultáneas).
* Logística: courier, retiro en tienda (Click & Collect) o entrega local motorizada, con número de guía.
* Facturación electrónica SRI vinculada al pedido para emitir la factura del cliente final.

---

## 7. Bondades

| Bondad | Qué resuelve |
|---|---|
| **Adaptable a cualquier rubro** | La forma del producto se define con datos (plantilla + atributos), sin programar nada nuevo: textil, ferretería, alimentos, calzado, servicios… |
| **Plantillas reutilizables** | Un arquetipo se diseña una vez y se usa en cientos de productos; el alta se vuelve guiada y consistente |
| **Atributos tipados** | Cada atributo sabe qué control mostrar (texto, número, Sí/No, color), si genera SKU y su unidad; se acaban los campos ambiguos |
| **SKU 100 % manual** | Los códigos comerciales los decide el negocio, no el sistema; nunca se sobrescriben |
| **Fotos sin duplicar** | Una foto del modelo o del grupo es heredada por N variantes: menos almacenamiento, menos trabajo y cambios consistentes |
| **Jerarquía persistida** | Cada producto guarda su arquetipo (familia) y su ruta (Marca, Material, Modelo…): filtros y reportes por cualquier nivel |
| **Búsqueda de alto rendimiento** | Índices GIN sobre atributos y dimensiones permiten filtrar por especificaciones en tiempo logarítmico |
| **Trazabilidad de inventario** | Documentos inmutables + kárdex promedio ponderado para conciliar con compras y facturación |
| **Anti-sobreventa** | Reserva atómica al crear el pedido y liberación inmediata al cancelar |
| **Límites por plan** | Los tiers (Small/Medium/Big/Enterprise) controlan variantes y plantillas, tanto en el backend como de forma proactiva en la UI |
| **Integración SRI** | Los ítems y servicios del catálogo son la base directa de la facturación electrónica ecuatoriana |

---

## 8. Cómo se genera una plantilla

Una plantilla se puede generar de dos formas, y ambas terminan en el mismo formato persistido:

1. **Desde la interfaz** (Catálogo → Plantillas → Nueva): se agregan niveles, se vinculan atributos del diccionario y se elige el alcance de fotos.
2. **Desde el análisis de productos** (sección 9): se estudia la línea de productos y se traduce el resultado a niveles y atributos.

### 8.1 Estructura persistida

La plantilla guarda su estructura en `hierarchyTreeJson` (JSONB). Ejemplo del arquetipo de calcetines:

```json
[
  {
    "id": "lvl-1",
    "name": "Colección / Familia",
    "hasColor": false,
    "hasImages": false,
    "attributes": ["Marca", "Material"],
    "photoScope": "none"
  },
  {
    "id": "lvl-2",
    "name": "Variantes Físicas",
    "hasColor": false,
    "hasImages": true,
    "attributes": ["Caña", "Talla"],
    "photoScope": "group"
  }
]
```

### 8.2 Cómo se interpreta al crear un producto

| Elemento de la plantilla | Qué produce en el alta |
|---|---|
| Niveles intermedios | **Atributos del Modelo** (Marca, Material…) → se guardan en la ruta jerárquica del producto |
| Nivel terminal | **Ejes de variante** → combinaciones y SKUs (Caña × Talla) |
| Atributo con `isVariantAxis = false` | Aunque esté en el nivel terminal, se captura como atributo del modelo y **no genera SKUs** |
| Orden de los atributos del terminal | Define la agrupación: primero el color (si existe), si no el primero declarado; el resto son filas internas |
| `photoScope` | `model` → galería del padre; `group` → barra compartida por grupo; `variant` → foto por SKU |
| Tipos de dato | Control de captura: texto, número (con unidad), Sí/No, color (ColorPicker) |

Además, cada producto guarda su `family_id` (la plantilla) y un `hierarchy_path_json` con los valores del modelo (ej. `Marca=Nike`, `Material=Algodón`), lo que permite filtrar y agrupar por cualquier atributo.

### 8.3 Invariantes de generación

* La plantilla tiene **1..N niveles**; el último es siempre el terminal.
* Si el terminal queda **sin atributos**, el alta usa una dimensión por defecto (Talla). El sistema **avisa** en el constructor y pide confirmación antes de guardar.
* Un atributo declarado como **descriptivo** nunca crea SKUs, esté en el nivel que esté.
* Si un color se declara como eje, se convierte en la **dimensión principal** (tarjetas por color).
* El alcance de fotos efectivo es el **más consolidado** de la plantilla: `modelo > grupo > variante`.

---

## 9. Cómo analizar productos para derivar sus plantillas

El objetivo es convertir una ficha de producto (o un catálogo completo) en **una plantilla reutilizable**. El método es siempre el mismo: separar lo que **el cliente elige** de lo que **solo describe**, y lo que **cambia físicamente** de lo que no.

### 9.1 Levantar la información

Para cada familia de productos, llenar una tabla como esta:

| Pregunta | Ejemplo calcetines | Ejemplo ferretería |
|---|---|---|
| ¿Qué se vende exactamente? | Par de calcetines deportivos | Perno hexagonal |
| ¿El cliente elige algo al comprar? | Caña y talla | Medida |
| ¿Qué variable cambia físicamente y necesita stock propio? | Caña (foto distinta) y talla (SKU) | Medida |
| ¿Qué solo describe la ficha? | Marca, Material, Actividad | Material, Acabado |
| ¿Cambia el precio por variante? | No | Sí (por medida) |
| ¿La foto cambia por…? | por caña (grupo) | no aplica |
| ¿Es intangible? | No | No |

### 9.2 Árbol de decisión

```
¿Es un servicio (intangible)?                → SÍ → Producto tipo Servicio (sin stock ni SKU obligatorio)
¿Se vende sin ninguna variación?             → SÍ → Producto simple (sin plantilla o 1 nivel)
¿Qué elige el cliente al comprar?            → esos atributos son EJES (generan variantes/SKU)
¿Qué variable tiene stock propio?            → EJES también
¿Qué dato solo describe y no cambia el SKU?  → DESCRIPTIVO (isVariantAxis = false)
¿Dónde cambia la foto?
   · una sola para todo el producto         → photoScope = model
   · una por valor principal (color/caña)   → photoScope = group
   · una por cada SKU                       → photoScope = variant
```

**Regla de oro:** si la variable tiene **stock propio** o **precio propio**, es un **eje (SKU)**. Si solo es un dato de la ficha, va como **descriptivo** en el nivel del modelo.

### 9.3 Traducir el análisis a niveles

| Resultado del análisis | Nivel de la plantilla |
|---|---|
| Colección, línea, familia, tipo | Nivel 1 (Base / Colección) |
| Modelo, estilo, acabado, uso | Nivel 2 (Submodelo / Estilo) — si aporta contexto |
| Ejes que generan SKU (talla, color, medida, caña) | Nivel terminal |
| Descriptivos (marca, material, actividad) | Nivel del modelo, como descriptivos |

Los niveles intermedios **no deben inventarse**: cada nivel debe aportar contexto real de negocio. Si un producto solo tiene ejes, basta con **2 niveles** (colección + variantes).

### 9.4 Elegir el tipo de dato

| Tipo de atributo | Tipo de dato | Unidad | Ejemplo |
|---|---|---|---|
| Talla (letra o rango) | Texto | — | S, M, L / 35-38 |
| Medida | Número | `mm`, `cm`, `pulg` | 6, 8, 10 |
| Color | Color | — | ColorPicker = muestra + nombre |
| Característica Sí/No | Sí / No | — | Impermeable |
| Cualquier otro | Texto | — | Material, Acabado |

### 9.5 Errores comunes

* **Colores únicos como eje:** si el producto solo se vende en un color, el color debe ser **descriptivo** (si no, generas un SKU idéntico por color).
* **Descriptivos en el terminal:** un atributo descriptivo en el nivel final se capturará como modelo; es válido, pero mejor declararlo en su nivel para claridad.
* **Niveles decorativos:** niveles que no aportan contexto generan confusión y campos vacíos.
* **Atributos libres duplicando el diccionario:** escribir "Material" a mano cuando ya existe en el diccionario impide que apliquen tipos, unidad y valores estandarizados.
* **Medidas sin unidad:** "6" es ambiguo; "6 mm" no.
* **Mezclar ejes y descriptivos sin marcar el uso:** siempre revisar la columna "Uso en variantes" al crear cada atributo.

### 9.6 Checklist antes de crear la plantilla en el sistema

- [ ] Identifiqué qué vende el negocio como **unidad de venta** (SKU).
- [ ] Listé las variables y marqué cuáles **generan SKU** y cuáles son **descriptivas**.
- [ ] Cada atributo del diccionario tiene **tipo de dato**, **uso en variantes** y **unidad** (si aplica).
- [ ] Elegí cuántos niveles aportan contexto real (no decorativos).
- [ ] El nivel terminal contiene **los ejes**, en el orden correcto (color primero si agrupa tarjetas).
- [ ] Definí dónde se capturan las fotos (modelo, grupo o variante).
- [ ] Probé el alta de un producto de muestra y verifiqué: tarjetas, filas, SKUs manuales, fotos y stock inicial.

---

## 10. Límites actuales y hoja de ruta

* La plantilla define N niveles, pero el producto materializa **modelo + variantes** (2 niveles); los intermedios viven como atributos/ruta, no como nodos navegables.
* La herencia de fotos (modelo/grupo) se resuelve hoy en el detalle del catálogo; falta aplicarla igual en la vitrina Ecommerce.
* Las fotos compartidas se guardan referenciando el valor de grupo (no existe aún una biblioteca de assets con referencia única).
* Las plantillas referencian atributos por **nombre**; la vinculación por ID está prevista para que los renombres sean totalmente seguros.
* Editar una plantilla **no reestructura** productos ya creados: moldea los próximos productos o los próximos ingresos.

---

## 11. Glosario

| Término | Significado |
|---|---|
| **Arquetipo / Plantilla** | Molde que define niveles, atributos y captura de fotos de un tipo de producto |
| **Atributo (diccionario)** | Especificación reutilizable con valores, tipo de dato y uso en variantes |
| **Eje de variante** | Atributo que genera combinaciones y SKUs (Talla, Color, Caña…) |
| **SKU** | Código único de la variante vendible/inventariable |
| **photoScope** | Alcance de captura fotográfica: modelo, grupo o variante |
| **Colores secundarios** | Colores adicionales de una variante bicolor; se combinan con el color principal de la tarjeta |
| **Kárdex** | Registro valorado de movimientos de inventario (promedio ponderado) |
| **Disponible** | Cantidad física menos cantidad reservada por pedidos o talleres |

---

## 12. Anexo — Rutas principales

```
Catálogo     /api/v1/tenants/{tenantId}/catalog/items
             /api/v1/tenants/{tenantId}/catalog/categories
             /api/v1/tenants/{tenantId}/catalog/variant-templates
             /api/v1/tenants/{tenantId}/catalog/product-templates

Bodegas      /api/v1/tenants/{tenantId}/warehouses
Inventario   /api/v1/tenants/{tenantId}/inventory/stock
             /api/v1/tenants/{tenantId}/inventory/movements
             /api/v1/tenants/{tenantId}/inventory/documents
             /api/v1/tenants/{tenantId}/inventory/billing-egress

Ecommerce    /api/v1/tenants/{tenantId}/ecommerce/orders
```
