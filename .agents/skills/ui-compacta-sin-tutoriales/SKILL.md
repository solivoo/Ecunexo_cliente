---
name: ui-compacta-sin-tutoriales
description: >-
  Estándares de diseño UI compacto, ergonómico y agnóstico en EcuNexo: erradicación de textos
  tipo tutorial, eliminación de párrafos explicativos en formularios, uso de placeholders genéricos
  ('Escriba aquí...', 'Seleccione una opción...'), máxima densidad visual enterprise y diseño directo
  para operadores profesionales.
---

# UI Compacta, Ergonómica y Agnóstica (Anti-Tutorial) en EcuNexo

Este estándar establece las directrices obligatorias de diseño, composición y redacción para construir interfaces de usuario de alta densidad en EcuNexo. Está dirigido a operadores comerciales, analistas de inventario y personal contable que utilizan el software diariamente como herramienta de trabajo intensivo.

---

## 1. Filosofía Enterprise: La UI No es un Manual de Usuario

1. **Operadores Profesionales, No Principiantes en un Onboarding:**
   - Quien usa EcuNexo ingresa decenas o cientos de facturas, productos, variantes y transferencias al día.
   - Cada párrafo explicativo, bloque con borde punteado o texto largo empuja los campos y botones de acción debajo del pliegue de la pantalla (*below the fold*), forzando scroll innecesario y ralentizando la operativa.
2. **Affordance sobre Explicaciones:**
   - La interfaz debe explicarse por su propia estructura: una etiqueta clara (`Nombre`, `Tipo de Atributo`, `Unidad`), un selector preciso y botones de acción directos.
   - **PROHIBIDO:** Incluir párrafos pedagógicos, sermones sobre cómo la base de datos o el catálogo procesará los datos, o instrucciones evidentes dentro de tarjetas o modales.

---

## 2. Regla de Placeholders y Textos Agnósticos

Los `placeholder` en `TextBox`, `Select` o `SearchBox` deben ser **estrictamente genéricos, concisos y agnósticos**.

### Tabla de Equivalencias (Anti-Tutorial):

| Tipo de Control | ❌ INCORRECTO (Modo Tutorial / Explicativo) |  CORRECTO (Agnóstico y Conciso) |
| :--- | :--- | :--- |
| **Input de Texto** | `placeholder="Ej. Pequeño, Mediano, Grande o 100% Algodón…"` | `placeholder="Escriba aquí..."` |
| **Input de Nombre** | `placeholder="Ej. Descripción, Talla, Color, Material, Peso…"` | `placeholder="Nombre..."` o `placeholder="Escriba aquí..."` |
| **Select / Desplegable** | `placeholder="Agregar del diccionario o seleccione para variantes…"` | `placeholder="Seleccione uno..."` o `placeholder="Seleccionar..."` |
| **Input de Unidad** | `placeholder="Ej. cm, mm, g, kg, W, ml, pulgadas…"` | `placeholder="Unidad (ej. cm, kg)..."` o `placeholder="Escriba aquí..."` |
| **Buscador** | `placeholder="Buscar por nombre o valor (ej. Talla, Color, Material)…"` | `placeholder="Buscar..."` |
| **Input de Añadir** | `placeholder="Escribe una opción arriba y pulsa Añadir o pulsa Enter…"` | `placeholder="Escriba aquí..."` |

---

## 3. Erradicación de Helper Texts y Párrafos Didácticos

1. **Cero Párrafos bajo Inputs o Selects:**
   - Eliminar textos como `<p style={{ fontSize: '0.78rem' }}>Para notas, descripciones o composición...</p>`.
   - Si la opción del select dice *"Texto Libre / Descripción"*, es redundante y visualmente contaminante poner un párrafo debajo diciendo *"Para notas y descripciones"*.
2. **Cero Etiquetas Paranoicas:**
   - Evitar etiquetas con aclaraciones redundantes entre paréntesis:
     - ❌ `Opciones Estandarizadas (Valores de la Escala)` →  `Opciones`
     - ❌ `Valores Sugeridos (Opcional para texto libre)` →  `Opciones` (u omitir la sección si no aplica).
3. **Visibilidad Condicional en lugar de Bloques Vacíos Explicativos:**
   - Si un atributo es de tipo texto libre, numérico o booleano, **no renderizar** el formulario de chips/opciones. No tiene sentido mostrar una sección de valores con un cartel explicando que no lleva valores.
   - Si un tipo requiere opciones (ej. tallas o colores), solo allí se muestra el input y las etiquetas agregadas.

---

## 4. Empty States Mínimos y Densos (Non-Preachy)

Cuando una lista, grilla o contenedor esté vacío, debe comunicarse de forma sobria y compacta:

* ❌ **PROHIBIDO (Cartel de Tutorial):**
  ```tsx
  <p className="app-shell__muted" style={{ padding: '0.75rem', border: '1px dashed ...' }}>
    Sin opciones predefinidas. En la ficha de cada producto o variante se ingresará el texto o valor libremente.
  </p>
  ```
*  **CORRECTO (Minimalista y Directo):**
  ```tsx
  <span style={{ fontSize: '0.78rem', color: 'var(--glb-muted)' }}>
    Sin opciones
  </span>
  ```
  O simplemente **no renderizar nada** si no aporta valor operativo.

---

## 5. Densidad Visual y Ergonomía Espacial

1. **Gaps y Paddings Compactos:**
   - En modales y formularios de creación: usar `gap: 0.6rem` a `0.75rem`.
   - Evitar separadores artificiales gigantes (`margin-top: 1.5rem`) o padding inflado que obligue al usuario a hacer scroll para ver el botón `Guardar`.
2. **Modales Reducidos:**
   - Un modal de creación rápida no debe superar los `480px` a `520px` de ancho a menos que contenga una grilla tabular.
   - El botón principal de envío debe ser visible inmediatamente al abrir el modal en pantallas de cualquier resolución estándar (laptops de 1366x768 o monitores de 1080p/2K/4K).

---

## 6. Checklist de Verificación (Anti-Tutorial)

Antes de dar por terminada cualquier vista o componente UI:

- [ ] ¿Hay algún párrafo de más de 1 línea explicando qué hace un campo? → **Eliminarlo.**
- [ ] ¿Los placeholders dicen frases largas con *"Ej. X, Y, Z o..."*? → **Reemplazar por "Escriba aquí..." o "Seleccione...".**
- [ ] ¿El empty state parece un párrafo de documentación técnica? → **Reemplazar por "Sin registros" o "Sin opciones".**
- [ ] ¿Los campos irrelevantes para la opción seleccionada están ocultos en vez de mostrar un cartel explicativo? → **Ocultar condicionalmente.**
- [ ] ¿La pantalla es compacta, limpia y permite operar rápido sin scrolls innecesarios? → **Cumple estándar.**
