# Ejercicio — Ingresar productos con distintas estructuras

Práctica manual en la UI. Basado en el plan de catálogo (plantilla = forma; ítem = valores).

Vas a crear, en este orden:

1. Atributos que falten en el diccionario  
2. Cuatro plantillas  
3. Cinco productos  

En cada producto, anota antes: peldaños, datos, ejes y fotos. Luego abre la pantalla.

---

## Mapa del ejercicio

| # | Qué crear | Estructura |
|---|---|---|
| A | Atributos | Diccionario |
| B1 | Plantilla Repuesto | 1 nivel, solo datos, fotos del producto |
| B2 | Plantilla Calcetines | Colección › Modelo › Talla × Caña × Color, **foto por cada código** |
| B3 | Plantilla Camisas | Modelo › Talla × Manga × Color, fotos por color |
| B4 | Plantilla Aceites | Presentación: Marca + Sabor × Contenido, fotos del producto |
| C1 | Asesoría contable | Servicio, sin plantilla |
| C2 | Filtro de aceite | Un solo código (plantilla Repuesto) |
| C3 | Calcetín Runner | Matriz con plantilla Calcetines |
| C4 | Camisa Oxford | Matriz con plantilla Camisas |
| C5 | Aceite de oliva | Matriz con plantilla Aceites |

---

## A. Diccionario

**Ruta:** Catálogo → Atributos

Si ya existen escalas de sistema (Medias, Ropa Adulto, Colores Básicos), úsalas. Crea solo lo que falte.

### Cómo crear un atributo

1. Nuevo atributo.  
2. Nombre.  
3. Tipo de dato (Texto, Número, Color…).  
4. Uso: *genera variantes* o *solo descriptivo*.  
5. Valores predefinidos.  
6. Guardar.

### Descriptivos (datos de ficha)

| Nombre | Tipo | Valores ejemplo |
|---|---|---|
| Marca | Texto | Nike, Adidas, Bosch, Extra Virgen |
| Material | Texto | Algodón |
| Referencia | Texto | — |
| Tela | Texto | Oxford |
| Corte | Texto | Regular, Slim |
| Deporte | Texto | Running, Casual |

### Que generan variantes (ejes)

| Nombre | Tipo | Valores |
|---|---|---|
| Tallas | Texto | 35-38, 39-41, 42-44 y/o S, M, L, XL |
| Tipo de Caña | Texto | Corta, Media, Larga |
| Color | Color | Negro, Blanco, Azul, Rojo |
| Largo de Manga | Texto | Corta, Larga |
| Sabor | Texto | Clásico, Ajo |
| Contenido | Texto | 250 ml, 500 ml |

**Listo cuando:** ves en el listado los nombres que vas a usar en las plantillas.

---

## B. Plantillas

**Ruta:** Catálogo → Plantillas → Nueva

En cada nivel:

- **Nombre del nivel**  
- **Datos de este nivel** (se llenan una vez)  
- **Ejes de este nivel** (multiplican el código)

Al final de la página: **Fotos** (una sola decisión: dónde vive la galería) y el resumen de una línea. Luego **Guardar Plantilla**.

Nota: esa decisión no limita cuántas fotos tiene cada código. En cualquier alcance, cada foto que subas se procesa a **3 tamaños** (sm / lg / xl).

---

### B1. Ejercicio · Repuesto simple

**Antes de abrir la pantalla**

- Peldaños: Modelo  
- Datos: Marca, Referencia  
- Ejes: ninguno  
- Fotos: Del producto  

**Pasos**

1. Nombre: `Ejercicio · Repuesto simple`  
2. Para qué sirve: `Piezas de un solo código`  
3. Activa: sí  
4. Nivel 1 → nombre `Modelo`  
5. Datos: `Marca`, `Referencia`  
6. Ejes: vacío  
7. Fotos: **Del producto**  
8. Resumen debe decir algo como: *Modelo (Marca, Referencia). Un solo código. Fotos del producto.*  
9. Guardar  

**Comprueba:** en el listado aparece la plantilla; el resumen habla de un solo código.

---

### B2. Ejercicio · Calcetines deportivos

**Antes**

- Colección › Modelo › Variaciones  
- Datos: Deporte | Marca, Material  
- Ejes: Tallas × Tipo de Caña × Color  
- Fotos: **Por cada código** (cada SKU tiene su galería; la forma cambia entre combinaciones). Cada foto que subas genera 3 tamaños: sm, lg y xl

**Pasos**

1. Nombre: `Ejercicio · Calcetines deportivos`  
2. Nivel 1 `Colección` → Datos: `Deporte` · Ejes: vacío  
3. Agregar nivel  
4. Nivel 2 `Modelo` → Datos: `Marca`, `Material` · Ejes: vacío  
5. Agregar nivel  
6. Nivel 3 `Variaciones` → Datos: vacío · Ejes (en orden): `Tallas`, `Tipo de Caña`, `Color`  
7. Fotos: **Por cada código**  
8. Resumen: *Colección (Deporte) › Modelo (Marca, Material) › Tallas × Tipo de Caña × Color. Fotos por cada código.*  
9. Guardar  

**Comprueba:** tres niveles; fotos por cada código (no «por color» ni «del producto»). En el ítem, cada SKU admite varias fotos; el sistema guarda cada una en 3 tamaños (sm / lg / xl).

---

### B3. Ejercicio · Camisas

**Antes**

- Modelo › Variaciones  
- Datos: Tela, Corte  
- Ejes: Tallas × Largo de Manga × Color  
- Fotos: Por un eje → Color  

**Pasos**

1. Nombre: `Ejercicio · Camisas`  
2. Nivel 1 `Modelo` → Datos: `Tela`, `Corte`  
3. Agregar nivel  
4. Nivel 2 `Variaciones` → Ejes: `Tallas`, `Largo de Manga`, `Color`  
5. Fotos: **Por un eje** → **Color**  
6. Resumen: *Modelo (Tela, Corte) › Tallas × Largo de Manga × Color. Fotos por Color.*  
7. Guardar  

**Comprueba:** solo dos niveles (no inventes Colección vacía).

---

### B4. Ejercicio · Aceites

**Antes**

- Un peldaño: Presentación  
- Datos: Marca  
- Ejes: Sabor × Contenido  
- Fotos: Del producto  

**Pasos**

1. Nombre: `Ejercicio · Aceites`  
2. Nivel 1 `Presentación` → Datos: `Marca` · Ejes: `Sabor`, `Contenido`  
3. No agregues más niveles  
4. Fotos: **Del producto**  
5. Resumen: *Presentación (Marca) · Sabor × Contenido. Fotos del producto.*  
6. Guardar  

**Comprueba:** un solo nivel con datos y ejes.

---

## C. Productos

**Ruta:** Catálogo → Ítems → Nuevo

Primero elige **Cómo lo registras**:

| Tarjeta | Uso en este ejercicio |
|---|---|
| Usar una plantilla | C2, C3, C4, C5 |
| Producto con un solo código | (alternativa a C2 sin plantilla) |
| Servicio | C1 |

El **nombre del producto** lo escribes tú. No copies el nombre de la plantilla.

---

### C1. Servicio — Asesoría contable mensual

1. Nuevo ítem  
2. Tarjeta **Servicio**  
3. Nombre: `Asesoría contable mensual`  
4. Precio: `80`  
5. Descripción: `Paquete mensual de revisión y asesoría tributaria.`  
6. Código: vacío  
7. No debe aparecer bloque de variaciones  
8. Guardar producto  

**Comprueba:** en el listado figura como servicio.

---

### C2. Un solo código — Filtro de aceite OEM

1. Nuevo ítem  
2. Tarjeta **Usar una plantilla**  
3. Plantilla: `Ejercicio · Repuesto simple`  
4. Nombre: `Filtro de aceite OEM`  
5. Precio: `12.50`  
6. Código: `FILT-OEM-001` (obligatorio)  
7. En Modelo: Marca `Bosch`, Referencia `OF-451`  
8. No debe abrirse la matriz  
9. Guardar  

**Comprueba:** un físico con SKU; sin variantes hijas.

---

### C3. Matriz — Calcetín Runner Algodón

Este es el más largo. Piensa en **dos momentos**: primero la ficha (se llena una vez), después las combinaciones (cada una con su código).

**Qué estás armando**

Un producto padre «Calcetín Runner Algodón» y **8 códigos** hijos:

Talla (`35-38` o `39-41`) × Caña (`Corta` o `Media`) × Color (`Negro` o `Blanco`).

**Fotos:** cada SKU tiene **su propia galería** (puede llevar varias fotos). La silueta cambia con la caña, la talla y el color; no se hereda media entre filas (no engañas al cliente).
Al subir una imagen, el sistema genera **3 tamaños** de esa misma foto: **sm** (listados), **lg** (ficha/carrusel) y **xl** (detalle ampliado).
En el ejercicio: en cada una de las 8 filas sube al menos **1 foto distinta** (vale placeholder). Si quieres practicar la galería, sube 2–3 por algún SKU.

Si ya creaste la plantilla B2 con «fotos por color», edítala y cámbiala a **Por cada código** antes de seguir.

---

#### Paso 1 — Abrir el alta con la plantilla

1. Catálogo → Ítems → **Nuevo**.  
2. En **Cómo lo registras**, elige **Usar una plantilla**.  
3. En el selector, elige `Ejercicio · Calcetines deportivos`.  
4. Debajo debe verse el resumen de la plantilla (Colección › Modelo › Tallas × Caña × Color…).

Si no aparece la plantilla, vuelve a B2 y créala primero.

---

#### Paso 2 — Datos del producto (siempre visibles)

Completa solo esto:

| Campo | Valor |
|---|---|
| Nombre | `Calcetín Runner Algodón` |
| Categoría | la que quieras, o Sin categoría |
| Precio base | `3.50` |
| Descripción | opcional |

**No** busques un campo Código aquí: el código va en cada fila de la matriz, más abajo.

---

#### Paso 3 — Datos de la plantilla (ficha, una sola vez)

Debajo verás bloques por nivel. Llénalos así:

| Bloque que ves | Campo | Valor |
|---|---|---|
| Colección | Deporte | `Running` |
| Modelo | Marca | `Nike` |
| Modelo | Material | `Algodón` |

Hasta aquí no has creado ni un SKU. Solo describiste el modelo.

---

#### Paso 4 — Entender la matriz (antes de tocar)

Más abajo aparece el bloque de **variaciones** (tallas, caña, color).

La pantalla suele **agrupar por color**:

- Un grupo **Negro** con varias filas (talla + caña).  
- Un grupo **Blanco** con varias filas.

Cada **fila** = un código vendible = un SKU que tú escribes a mano.

Con 2 tallas × 2 cañas × 2 colores → **8 filas**.

---

#### Paso 5 — Dejar activos solo estos valores

Este paso arma la **rejilla física**. Todavía no escribas SKUs ni subas fotos: solo colores, tallas y cañas.

**Meta:** el contador de la barra debe decir exactamente:

> **8 variantes físicas en 2 colores**

---

##### Qué vas a dejar (mapa mental)

```
Negro (#000000)
  ├─ 35-38 · Corta
  ├─ 39-41 · Corta
  ├─ 35-38 · Media
  └─ 39-41 · Media

Blanco (#FFFFFF)
  ├─ 35-38 · Corta
  ├─ 39-41 · Corta
  ├─ 35-38 · Media
  └─ 39-41 · Media
```

En pantalla el color se guarda como **hex**, no como la palabra «Negro». Usa:

| Cómo lo llamamos en el ejercicio | Qué eliges en la UI |
|---|---|
| Negro | `#000000` (swatch negro) |
| Blanco | `#FFFFFF` (swatch blanco) |

---

##### 5.0 Ubícate en la pantalla

1. Baja hasta el bloque **Variantes** (debajo de Colección / Modelo).
2. Verás un encabezado «Variantes» y una barra con:
   - a la izquierda: el contador (`0 variantes…` o ya algunas);
   - a la derecha: botón **`+ Añadir Color`**.
3. Debajo está la lista de **tarjetas por color** (o un mensaje vacío).

Si el mensaje dice *«No hay variantes… Haz clic en Añadir Color»*, estás en el arranque correcto.

---

##### 5.1 Crear el color Negro (primer grupo)

1. Clic en **`+ Añadir Color`**.
2. Se abre el popup **«Nuevo Color»**.
3. En la grilla de presets, elige el **cuadrado negro** (`#000000`).
   - También puedes pegar `#000000` en «Color personalizado (hexadecimal)».
4. Confirma / guarda el popup (botón de aceptar del modal).
5. Debe aparecer **una tarjeta** con:
   - etiqueta `Color:` + ColorPicker en negro;
   - badge a la derecha (ej. `1 talla / ítem` si solo creó una fila);
   - botones **`Duplicar Color`** y papelera;
   - debajo, una o más filas con selects **Tallas** y **Tipo de Caña**.

Si el ColorPicker no quedó en negro: ábrelo en el encabezado de la tarjeta y cámbialo a `#000000`.

---

##### 5.2 Armar las 4 filas del Negro (Talla × Caña)

Dentro de la tarjeta Negro, cada fila es una variante. A la derecha de cada fila hay íconos:

- **Copiar** = duplicar esa talla (misma fila, SKU vacío).
- **Papelera** = eliminar esa fila.

Al pie de la tarjeta: **`+ Añadir Tallas en «#000000»`** (el texto usa el hex del grupo).

**Objetivo dentro de Negro:** exactamente estas 4 filas, sin más:

| Fila | Select Tallas | Select Tipo de Caña |
|---|---|---|
| #1 | `35-38` | `Corta` |
| #2 | `39-41` | `Corta` |
| #3 | `35-38` | `Media` |
| #4 | `39-41` | `Media` |

**Cómo llegar ahí, paso a paso:**

1. Mira la primera fila que ya existe.
2. Abre el Select **Tallas** → elige `35-38`.
   - Si no está: elige `+ Nueva...`, escribe `35-38`, Enter.
3. Abre el Select **Tipo de Caña** → elige `Corta`.
   - Si no está: `+ Nueva...` → `Corta`.
4. Clic en **`+ Añadir Tallas en «#000000»`** → aparece una fila nueva.
5. En la fila nueva: Tallas `39-41`, Caña `Corta`.
6. Otra vez **Añadir Tallas…** → Tallas `35-38`, Caña `Media`.
7. Otra vez **Añadir Tallas…** → Tallas `39-41`, Caña `Media`.

**Si sobran filas** (ej. vino `42-44` o una caña que no usas):

1. Identifica la fila sobrante.
2. Clic en la **papelera** de esa fila.
3. Repite hasta quedar en 4.

**Si te equivocaste y duplicaste una combinación** (dos veces `35-38` + `Corta`):

1. Deja una.
2. Borra la otra con la papelera **o** cámbiale talla/caña a la que falte.

**Comprueba Negro:**

- Badge del grupo: **`4 tallas / ítems`**.
- Las 4 combinaciones de la tabla de arriba, sin repetidos.
- No hay `42-44`, `Alta`, etc.

---

##### 5.3 Crear el color Blanco (segundo grupo)

Camino recomendado (copia las 4 tallas de una vez):

1. En la tarjeta Negro, clic **`Duplicar Color`**.
2. Se abre el popup **«Duplicar Color a un color nuevo»**.
3. Elige el preset **blanco** (`#FFFFFF`) o pégalo en el hex.
4. Confirma.
5. Debe aparecer un toast tipo: se crearon 4 tallas en el nuevo color.
6. Ahora tienes **2 tarjetas**. En la nueva, el ColorPicker debe ser blanco.
   - Si no: cámbialo a `#FFFFFF` en el encabezado.

Camino alternativo (si no usas Duplicar):

1. **`+ Añadir Color`** → elige blanco → confirma.
2. En la tarjeta blanca, vuelve a armar las 4 filas como en 5.2 (más lento).

**Si hay un tercer color** (azul del preset por defecto, etc.):

1. Ve a esa tarjeta.
2. Clic en la **papelera del encabezado** (borra el color y todas sus filas).
3. Confirma si pide confirmación.
4. Quédate solo con Negro y Blanco.

**Comprueba Blanco:** badge **`4 tallas / ítems`** y las mismas 4 combinaciones Talla × Caña.

---

##### 5.4 Checklist final del paso 5

Mira la barra superior y las tarjetas:

| Chequeo | Debe ser |
|---|---|
| Contador global | **8 variantes físicas en 2 colores** |
| Nº de tarjetas | Exactamente **2** |
| Hex del 1.er grupo | `#000000` |
| Hex del 2.º grupo | `#FFFFFF` |
| Filas por grupo | **4** y **4** |
| Combinaciones | Solo `35-38/39-41` × `Corta/Media` |
| SKUs / fotos / precios | Aún puedes dejarlos; el paso 6 los completa |

**Errores típicos y qué hacer:**

| Qué ves | Causa | Qué hacer |
|---|---|---|
| `0 variantes` y mensaje vacío | Aún no creaste el primer color | 5.1 → Añadir Color → negro |
| 1 color con 1 sola fila | No añadiste las otras tallas | 5.2 → Añadir Tallas… tres veces |
| 2 colores pero 6 u 8 filas en uno | Trajo tallas de más del diccionario | Papelera en filas sobrantes |
| 3+ colores | Duplicaste de más o quedó un preset | Papelera en el encabezado del color extra |
| Contador 12 / 16 / 24… | Demasiadas combinaciones | Recorta a 2×2×2 como el mapa de arriba |
| El Select no tiene `Media` | Valor no cargado en el eje | `+ Nueva...` y escribe `Media` |
| Confundes Negro/Blanco | Solo ves hex | Negro = `#000000`, Blanco = `#FFFFFF` |

Cuando el checklist esté en verde, pasa al **paso 6** (escribir los 8 SKUs).

---

#### Paso 6 — Escribir el SKU de cada fila

En cada fila hay un campo **SKU**. Completa los 8 (tienen que ser distintos):

| Color | Caña | Talla | SKU a escribir |
|---|---|---|---|
| Negro | Corta | 35-38 | `CALC-RUN-3538-CORTA-NEG` |
| Negro | Corta | 39-41 | `CALC-RUN-3941-CORTA-NEG` |
| Negro | Media | 35-38 | `CALC-RUN-3538-MEDIA-NEG` |
| Negro | Media | 39-41 | `CALC-RUN-3941-MEDIA-NEG` |
| Blanco | Corta | 35-38 | `CALC-RUN-3538-CORTA-BLA` |
| Blanco | Corta | 39-41 | `CALC-RUN-3941-CORTA-BLA` |
| Blanco | Media | 35-38 | `CALC-RUN-3538-MEDIA-BLA` |
| Blanco | Media | 39-41 | `CALC-RUN-3941-MEDIA-BLA` |

Si el orden de las filas en pantalla no coincide con la tabla, no importa: mira talla / caña / color de esa fila y ponle el SKU que corresponda.

**Precio:** si hay botón para copiar el precio base (`3.50`) a todas, úsalo. Si no, pon `3.50` en cada fila.

**Fotos (galería por código):** en este producto la forma cambia entre SKUs (talla + caña + color).
No uses una sola foto por color: el cliente vería la misma imagen en tallas/cañas distintas y se engaña.
En **cada una de las 8 filas** sube al menos 1 imagen distinta (placeholder vale). Cada imagen se guarda en 3 tamaños: **sm**, **lg** y **xl**. Puedes añadir varias fotos al mismo SKU (ángulos / detalle).

---

#### Paso 7 — Guardar y revisar

1. **Guardar producto**.  
2. En el listado de ítems debe aparecer **un** producto: `Calcetín Runner Algodón` (no las 8 filas sueltas).  
3. Ábrelo.  
4. En **Variantes** debes ver 8 filas.  
5. La columna de variación debe verse corta (`35-38 · Corta`, etc.), no el nombre largo del padre.  
6. El lápiz de una fila abre la ficha de **esa** variante.
7. Cada variante tiene **su propia galería** (no compartida solo por color); al abrir una foto deben existir los 3 tamaños (sm / lg / xl).

---

#### Si te trabás

| Qué ves | Qué hacer |
|---|---|
| No aparece la matriz | ¿Elegiste la plantilla de calcetines? La de Repuesto no abre matriz. |
| Solo 1 fila | Faltan valores activos de talla/caña/color; actívalos o añade el color. |
| Muchísimas filas | Desactiva valores que no uses; quédate en 2×2×2. |
| Pide código arriba, en Datos del producto | No debería, con plantilla de ejes. Revisa que la plantilla sea la de calcetines. |
| No sé qué SKU va en qué fila | Mira los chips/campos de esa fila (talla, caña, color) y usa la tabla del paso 6. |
| Solo deja subir foto por color | La plantilla debe ser **Por cada código / variante**, no por grupo de color. Edita B2 y vuelve a crear el ítem. |
| Todas las filas muestran la misma imagen | Estás reutilizando foto de color; sube una distinta por fila. |

**Comprueba:** 1 padre + 8 variantes; cada una con galería propia (mín. 1 foto × 3 tamaños); grid legible.

---

### C4. Matriz — Camisa Oxford Manga

1. Plantilla `Ejercicio · Camisas`  
2. Nombre: `Camisa Oxford Manga`  
3. Precio: `28`  
4. Tela: `Oxford`, Corte: `Regular`  
5. Ejes activos:  
   - Tallas: `S`, `M`, `L`  
   - Manga: `Corta`, `Larga`  
   - Color: `Blanco`, `Azul`  
6. Total: **12** filas  
7. SKUs: `CAM-OXF-S-CORTA-BLA`, etc.  
8. Guardar  

**Comprueba:** 12 variantes; ejes distintos al calcetín (manga, no caña).

---

### C5. Matriz — Aceite de oliva gourmet

1. Plantilla `Ejercicio · Aceites`  
2. Nombre: `Aceite de oliva gourmet`  
3. Precio: `9.90`  
4. Marca: `Extra Virgen`  
5. Sabor: `Clásico`, `Ajo`  
6. Contenido: `250 ml`, `500 ml`  
7. Total: **4** filas  
8. SKUs: `ACE-OLV-CLASICO-250`, `ACE-OLV-CLASICO-500`, `ACE-OLV-AJO-250`, `ACE-OLV-AJO-500`  
9. Guardar  

**Comprueba:** un solo bloque de ficha; 4 variantes.

---

## D. Recorrido final

1. Plantillas: las cuatro del ejercicio.  
2. Ítems (raíces): servicio, filtro, calcetín, camisa, aceite.  
3. Abrir calcetín → grid limpio → lápiz en una variante → volver.  
4. Nuevo ítem con plantilla Repuesto → no abre matriz.  
5. Nuevo ítem Servicio → no exige código.

---

## Si algo falla

| Problema | Qué revisar |
|---|---|
| No salen valores de talla/color | Atributos del diccionario sin valores |
| La plantilla abre matriz y no querías | Hay algo en **Ejes**; quítalo |
| El producto se llama como la plantilla | Borra el nombre y escribe el del producto |
| Demasiadas variantes / límite del plan | Menos valores activos en ejes |
| Nombre largo en el grid | Debe verse limpio al recargar; el lápiz sigue yendo a la ficha de la variante |
| Variantes OK pero columna Foto vacía (cámara) | El ítem se guardó; las fotos van a Backblaze B2. Sin conexión/credenciales STORAGE_* el producto queda sin imágenes. Vuelve a subirlas con el lápiz de cada variante. |
| «Imágenes del Producto» en el padre vacío | Con plantilla **por cada código** es normal: esa galería es del modelo/padre. Las fotos viven en cada SKU. |

---

## Orden sugerido en una sesión

1. Atributos  
2. Cuatro plantillas  
3. Servicio + filtro  
4. Calcetín  
5. Camisa  
6. Aceite  
7. Recorrido final  
