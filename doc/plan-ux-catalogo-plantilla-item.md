# Cómo se arma un producto cuando tiene muchas características

Un recorrido para el catálogo de EcuNexo. Parte de lo que le pasa a quien vende, mira productos chicos y productos largos, y llega a una forma de analizarlos —una arquitectura— que la pantalla puede seguir sin volverse un formulario infinito.

---

## 1. El problema

En una tienda entran cosas que no se parecen. Una hora de consultoría. Un filtro de aceite con un solo código. Un calcetín que cambia de talla, de altura de caña y de color, y cada combinación tiene su propia existencia en bodega. Las tres se llaman «producto» en la caja, en la factura y en la vitrina.

Si la pantalla de alta se dibuja para el calcetín, la consultoría obliga a inventar tallas que no existen. Si se dibuja para la consultoría, el calcetín cabe en un solo nombre y el inventario deja de saber qué hay de cada color. Si se dibuja con todos los campos posibles a la vista —niveles, colores, fotos, atributos, códigos— quien da de alta un repuesto ve el mismo muro que quien da de alta una camisa de tres dimensiones.

Ese muro es el problema de experiencia. El producto complejo sí necesita todas esas piezas. Mostrarlas juntas, en el mismo momento y con el mismo peso, hace que la persona no distinga qué describe al producto, qué cambia el stock y qué es solo una foto.

En la tienda online el daño se nota dos veces. Quien carga el catálogo se cansa y deja datos a medias. Quien compra recibe un selector confuso: a veces la talla está en la descripción, a veces es un botón, a veces hay treinta y seis fotos repetidas porque cada talla guardó la misma imagen del color negro.

Hace falta una manera de mirar cualquier producto y decidir, antes de abrir el formulario, qué partes tiene. Esa manera es la arquitectura. La interfaz solo la recorre.

---

## 2. Un producto pequeño

### La consultoría

Alguien vende una hora de asesoría contable.

Se pregunta, en voz alta, cómo la contaría un vendedor:

- Se llama «Asesoría contable mensual».
- Cuesta un valor.
- No hay bodega, ni talla, ni color.
- Una foto del servicio alcanza, o ninguna.

Aquí no hay jerarquía que recorrer. Hay un nombre, un precio y un código opcional. Pedir variaciones sería obligar al usuario a resolver un problema que su producto no tiene.

### El repuesto

Un filtro de aceite tiene marca, referencia y un código de barras. En la estantería hay cajas iguales. Si se acaba, se acaba ese código, no «el filtro negro talla M».

Sigue siendo pequeño, y ya aparece un dato que el servicio no tenía: la marca y la referencia describen el producto, pero no multiplican las existencias. Van en la ficha. El código es uno.

### La camiseta de un solo color

Una camiseta blanca, talla única, de una marca. Sigue habiendo un solo código. El color y la talla son datos del producto, escritos una vez. Todavía no son dimensiones.

El salto no está en «tener color» o «tener talla». El salto está en si ese dato cambia la pieza que se cuenta en bodega.

---

## 3. Un producto amplio

### El calcetín

Un calcetín deportivo se cuenta así, de lo general a lo concreto:

1. Colección: running.
2. Modelo: algodón, marca propia.
3. En la bodega hay piezas distintas según talla, altura de caña y color.

Tres tallas, tres cañas y cuatro colores son treinta y seis códigos. Cada uno entra, sale y se factura por separado. La foto, en cambio, casi nunca cambia con la talla: cambia con el color. A veces también con la caña, si la silueta se ve distinta. Subir treinta y seis imágenes iguales cansa y ensucia la vitrina. Subir una sola imagen para todo el modelo esconde el negro y el azul.

El mismo objeto, entonces, mezcla tres ritmos:

- Lo que se dice una vez del modelo (material, marca, colección).
- Lo que se multiplica (talla × caña × color).
- Lo que se fotografía en un punto intermedio (por color, no por cada talla).

### La camisa

La camisa agrega un eje que el calcetín no usa: el largo de manga. La tela y el corte siguen siendo del modelo. Quien analiza el producto no copia la plantilla del calcetín. Rehace las preguntas y obtiene otra combinación: tela y corte una vez; talla, manga y color en el código; la foto, otra vez, por color.

### El aceite

Marca en la ficha. En la góndola cambian el sabor y el contenido (250 ml, 500 ml, 1 L). Dos ejes, un solo nivel, sin colección ni modelo intermedio. La jerarquía aquí es corta. Forzar tres peldaños «porque el calcetín tenía tres» deja nombres vacíos que nadie va a llenar.

### Lo que enseñan los tres

| Producto | Cómo se cuenta | Qué se llena una vez | Qué cambia el stock | Dónde va la foto |
|---|---|---|---|---|
| Consultoría | Un nombre | El servicio | Nada | Opcional, en el servicio |
| Repuesto | Un código | Marca, referencia | Nada | En el producto |
| Calcetín | Colección, luego modelo, luego la pieza | Deporte, material | Talla × caña × color | Por color |
| Camisa | Modelo, luego la pieza | Tela, corte | Talla × manga × color | Por color |
| Aceite | La presentación | Marca | Sabor × contenido | Por presentación, o una del producto |

Ninguno es «el» formulario. Cada uno es un recorrido distinto sobre las mismas cuatro preguntas.

---

## 4. Cómo analizar un producto

Antes de diseñar la pantalla se analiza el producto como se analiza una estantería: de arriba hacia abajo, con lo que diría quien lo vende. El resultado es una arquitectura pequeña, repetible para el siguiente producto de la misma familia.

Se hacen cuatro preguntas, en este orden.

**1. ¿En qué peldaños se cuenta?**

Línea, colección, modelo, presentación, variaciones. Los que hagan falta, con el nombre que use el negocio. Un peldaño vacío no se crea. El aceite vive en uno. El calcetín vive en tres. El orden de los peldaños es el orden en que después se lee la ficha y la vitrina.

**2. ¿Qué se dice una sola vez en cada peldaño?**

Esos son los atributos: marca, material, temporada, tela, referencia. Acompañan al producto. No crean otro código ni otra fila de stock. Si el dato cambia, cambia la ficha, no la bodega.

**3. ¿Qué hace que dos piezas no sean intercambiables en bodega?**

Esos son los ejes: talla, color, caña, capacidad, sabor, contenido. Cada valor distinto es otra pieza contable. Los ejes se multiplican entre sí, vengan del peldaño que vengan. Tres tallas y cuatro colores son doce códigos, aunque la talla se haya anotado en un nivel y el color en otro.

La prueba es concreta. Si mañana entra mercadería y el bodeguero necesita un código distinto para no mezclarlas, ese dato es un eje. Si solo enriquece la descripción, es un atributo.

Un mismo concepto puede cambiar de papel según el negocio. La capacidad de un celular puede ser un dato del modelo («128 GB» escrito en la ficha) o un eje, si cada capacidad tiene su propio saldo. La decisión es de ese tipo de producto, no una ley del catálogo.

**4. ¿La foto cambia con cuál de esas respuestas?**

Cuatro destinos, y uno solo por tipo de producto:

- No lleva foto.
- Una foto del producto, compartida por todas las combinaciones.
- Una foto por uno o más ejes (el color, la caña), y el resto de ejes la hereda.
- Una foto por cada código, cuando el acabado de verdad cambia en cada combinación.

La foto no es otro eje. Es el grano en el que se mira el producto.

Con esas cuatro respuestas escritas, el producto ya tiene arquitectura. Dos productos de la misma familia comparten la arquitectura y cambian los valores. Por eso la arquitectura se dibuja una vez —la plantilla— y cada alta solo la llena.

---

## 5. La arquitectura

Cuatro piezas, usadas las veces que el producto pida.

| Pieza | Pregunta que responde | Ejemplo en el calcetín |
|---|---|---|
| Nivel | ¿En qué peldaño vive esto? | Colección → Modelo → Variaciones |
| Atributo | ¿Qué se dice una vez ahí? | Running; algodón |
| Eje | ¿Qué multiplica el código y el stock? | Talla × caña × color |
| Foto | ¿En qué grano se ve? | Una imagen por color |

La categoría queda fuera de esta arquitectura. Sirve para clasificar y reportar («Ropa deportiva › Calcetines»). No exige campos ni arma variaciones.

El diccionario de atributos queda al lado, como vocabulario. Ahí viven las escalas reutilizables: las tallas de calzado, los colores básicos, los materiales. La arquitectura de un producto elige cuáles de esas palabras entran, en qué nivel, y si en ese producto son atributo o eje. Guardar «Color» en el diccionario no obliga a que todo producto tenga color como variación.

Así se separan tres trabajos que hoy se pisan:

- Clasificar (categoría).
- Nombrar opciones que se repiten (diccionario).
- Decidir la forma de una familia de productos (plantilla) y llenarla (ítem).

---

## 6. De la arquitectura a una pantalla amable

La persona que arma la plantilla está diseñando la estantería. La persona que crea el ítem está poniendo un producto en ella. No ven los mismos controles.

### Quien diseña la plantilla

Ve la arquitectura, de arriba hacia abajo, con las opciones en el orden de las cuatro preguntas.

Primero el nombre de la plantilla: «Calzado deportivo», «Camisas», «Aceites». Es el nombre del molde, no el del producto.

Después, los niveles. Cada nivel muestra solo dos listas:

1. Datos de este nivel.
2. Ejes de este nivel.

Puede tener una, la otra, las dos, o ninguna mientras se está pensando. Se agregan niveles hasta que el relato del vendedor cabe. El calcetín termina en tres. El aceite termina en uno. No hay tres peldaños de regalo al abrir la pantalla.

El diccionario sugiere. Un atributo marcado como variación aparece primero entre los ejes; uno marcado como dato, primero entre los datos. Quien arma la plantilla puede pasarlo a la otra lista. Esa elección vale para esta familia y no reescribe el diccionario.

Al final, una sola pregunta de fotos para toda la plantilla. «Por un eje» ofrece los ejes ya colocados, estén en el nivel que estén. Si todavía no hay ejes, esa respuesta espera.

Debajo, una línea que lee la arquitectura en voz alta:

> Colección › Modelo (Material) › Talla × Caña × Color. Fotos por color.

Si no hay ejes, la línea dice que el producto tendrá un solo código. Esa frase es la comprobación. Si quien diseñó la plantilla no la reconoce, la jerarquía todavía no está bien analizada.

Lo que sale de cada tarjeta es lo que no ayuda a pensar: un interruptor de color aparte del eje Color, la pregunta de fotos repetida en cada nivel, una bolsa única de atributos donde el sistema decide en silencio cuál genera código, y un segundo diagrama que repite lo mismo que la línea de resumen.

### Quien crea el producto

No rearma la arquitectura. Elige un camino y completa valores.

Tres caminos, porque no todo producto pasa por una plantilla:

- **Usar una plantilla.** Elige el molde y ve el resumen. El formulario copia los niveles.
- **Producto con un solo código.** Nombre, categoría, precio, código, fotos. Sin variaciones.
- **Servicio.** Lo mismo, con código opcional y sin stock.

En los tres, los datos comerciales permanecen visibles: nombre, categoría, descripción y precio. El nombre del producto lo escribe quien lo da de alta. «Calzado deportivo» es la plantilla; «Calcetín running» es el producto.

Si eligió plantilla, el resto del formulario sigue la jerarquía:

1. Una tarjeta por nivel que tenga datos, en el mismo orden: Colección, luego Modelo.
2. Una sola zona de variaciones si en algún nivel hay ejes. Talla, caña y color aparecen juntos, con las opciones del diccionario, y cada fila es un código.
3. Las fotos en el grano que la plantilla fijó: en el producto, por color, por cada código, o ninguna.

Una plantilla sin ejes no abre la zona de variaciones. Usa el alta de un solo código. El tipo «físico» deja de significar «siempre hay matriz».

El control de cada dato sigue su naturaleza: una lista se elige, un número se escribe con su unidad, un sí o un no se marca, un color se toma del selector. El título de la tarjeta ya dice el nivel. No hace falta un rótulo técnico al lado del campo.

Guardar está en la cabecera y al final. Cancelar vuelve al listado. Los accesos a categorías, atributos y plantillas viven en un menú secundario y no se repiten como segundo botón de guardar.

La pantalla sigue siendo una sola vista, con tarjetas apiladas. No es un asistente de «siguiente». El orden es el de la lectura: primero lo que identifica al producto, después cada peldaño, después lo que se multiplica, después la imagen.

---

## 7. La solución, aplicada al catálogo

El catálogo ya separa categoría, diccionario, plantilla e ítem. La solución usa esa separación y cambia el orden en que la pantalla enseña las opciones.

La plantilla guarda la arquitectura en su jerarquía: cada nivel, con sus datos y sus ejes, más una decisión de fotos para el conjunto. El servidor conserva ese relato como está. No lo interpreta. Por eso la pantalla puede ser más clara sin cambiar el contrato de la plantilla.

Al crear el ítem, el relato se convierte en datos:

- Los atributos llenados en cada nivel quedan como la ruta del producto, de arriba hacia abajo.
- Todos los ejes, de todos los niveles, se reúnen y se multiplican. Si hay al menos uno, nace un producto padre —el modelo, sin stock propio— y un hijo por combinación, con su código, su precio y su saldo.
- Si no hay ejes, nace un solo ítem. Si es físico, el código es obligatorio.
- La foto del producto cuelga del padre. La foto por eje cuelga del padre marcada con el valor de ese eje (el negro, la caña corta). La foto por código cuelga del hijo.

Un hijo no tiene hijos. La amplitud del producto se expresa en los ejes, no en una cadena infinita de subproductos. Editar la plantilla después no reescribe los productos ya cargados: cada uno se quedó con la ruta y las variaciones del día en que se creó. Una plantilla que ya tiene productos no se borra.

Las plantillas que hoy existen, armadas como una sola lista de atributos por nivel, se siguen abriendo. Donde todavía no hay una lista explícita de ejes, se usa la regla que ya conoce el catálogo: el diccionario y el lugar del nivel dicen qué es dato y qué es variación. Las plantillas nuevas guardan las dos listas por separado, porque esa es la decisión que quien analizó el producto tomó a propósito.

---

## 8. Cómo se comprueba

La solución está bien si una persona puede hacer estas tres altas sin ver un control que no corresponda a su producto.

1. Un servicio: nombre, precio, sin variaciones.
2. Un repuesto de un solo código: marca y referencia, un código, fotos del producto.
3. Un calcetín: colección y material una vez; talla, caña y color en la matriz; una foto por color, heredada por las tallas de ese color.

Y si, al mirar el resumen de la plantilla, reconoce la frase que habría dicho en voz alta al empezar el análisis:

> Colección › Modelo (Material) › Talla × Caña × Color. Fotos por color.
