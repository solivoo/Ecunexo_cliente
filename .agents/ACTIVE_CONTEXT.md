# EcuNexo — Contexto Activo del Proyecto (Active Memory)

> Este archivo mantiene el hilo operativo del proyecto para ahorrar tokens y permitir que cualquier sesión retome el trabajo con precisión inmediata. Se actualiza al completar o cambiar de hito.

---

## 1. Estado Actual del Repositorio

* **Rama Activa:** `main` (sincronizada con `origin/main`).
* **Última Versión Publicada:** `v0.51.0`.
* **Hitos Recientes Completados:**
  - **Catálogo — Jerarquía por Niveles, Datos y Ejes en Plantillas y Alta Asistida (`HierarchyTemplateTreeBuilder.tsx`, `CreateCatalogItemPage.tsx`, `catalogArchetype.ts`, `ProductTemplateBuilderPage.tsx`, `ArchetypeModelFields.tsx`) [v0.51.0]:**
    * **Plantillas con datos y ejes por nivel:** el constructor visual clasifica de forma explícita los atributos descriptivos de la ficha del modelo vs. los ejes de variante por nivel, con una decisión única de alcance fotográfico (`model`, `group`, `variant`).
    * **Alta simplificada y transparente:** si la plantilla no declara ejes, el alta del ítem captura solo la ficha del modelo con un único código/SKU sin obligar matriz; si declara ejes, se despliega el constructor de matriz para completar solo los valores existentes sin duplicar jerarquías.
    * **Pruebas y verificación:** 14/14 tests en `templates.formation.test.ts`, build frontend limpio y verificado.
  - **Catálogo — Regla de Posición para Ejes de Variante y Ajustes de Plantilla (`catalogArchetype.ts`, `HierarchyTemplateTreeBuilder.tsx`) [v0.45.1]:**
    * **Solo el nivel terminal genera ejes/SKU:** en niveles intermedios únicamente el color asciende como eje; el resto de atributos queda como ficha del modelo, aunque el diccionario los tenga como «genera variantes». Evita que Marca, Colección, Categoría o Material exploten las columnas de la matriz (caso detectado con plantillas de 6 niveles).
    * **Badges y simulación** ahora reflejan la regla real por posición, con nota «solo el nivel terminal genera SKUs; recomendado 2–3 niveles».
    * **Selector de fotografías por nivel** reemplazado por un `Select` de glubox (antes era un híbrido pill + select nativo).
    * **«+ Añadir Color»** abre el modal con `ColorPicker` (ya no `window.prompt`).
    * **Verificación:** build frontend limpio; sin errores de lint en los archivos tocados.
  - **Catálogo — ColorPicker Consistente al Crear Colores (`VariantMatrixBuilder.tsx`) [sin bump de versión]:**
    * «+ Añadir Color» (sin valores predefinidos restantes) ya no usa `window.prompt`: abre el modal con **nombre + ColorPicker** (modo `add-group`) y crea la tarjeta con su color.
    * Quedaban cubiertos el swatch editable (modo `edit`) y «+ Nuevo Color…» del selector de tarjeta (modo `new`).
  - **Catálogo — Retiro del Precio Base Referencial en Alta Manual (`CreateCatalogItemPage.tsx`) [sin bump de versión]:**
    * En creación manual de productos **físicos (con variantes)** se elimina el campo «Precio base referencial»; el precio se captura por variante/SKU y el nombre ocupa el ancho liberado (`span-2`).
    * Los **servicios** mantienen «Precio base de venta».
    * El submit y el constructor de variantes ignoran el precio del padre cuando hay variantes (sin herencia automática de precio).
  - **Catálogo — UI de Variantes en Glubox, SKU Bicolor y Legibilidad (`VariantMatrixBuilder.tsx`, `variantMatrixBuilder.css`) [sin bump de versión]:**
    * **Controles glubox:** la ficha de variante migró de inputs/selects nativos a `Select` (dimensiones y selector de grupo), `TextBox` (SKU, tags, código de barras) y `NumberBox` (precio, stock); el SKU se normaliza a mayúsculas.
    * **Legibilidad:** cada variante se divide en dos líneas (dimensiones + SKU arriba; colores combinados, foto, tags, precio, stock, barras y acciones abajo) con ancho mínimo por campo para evitar truncamientos.
    * **Swatch de color evidente:** botón con borde punteado y paleta cuando no hay color asignado, tooltip «Elegir/Editar color» y apertura del `ColorPicker` de glubox.
    * **SKU bicolor (colores combinados):** en dimensiones de color, cada fila puede sumar colores secundarios (chips con muestra y quitar); el principal agrupa la tarjeta y conserva la herencia de foto; el título se compone «Principal / Secundarios / Talla» y se serializa en `customAttributesJson.colores_secundarios`.
    * **Verificación:** build frontend limpio; únicos avisos de lint preexistentes.
  - **Catálogo — Validación de Nivel Terminal sin Atributos + Documentación de Plantillas (`ProductTemplateBuilderPage.tsx`, `doc/modulo-catalogo-inventario-ecommerce.md`) [sin bump de versión]:**
    * **Validación:** aviso inline en el constructor y `Popup` de confirmación («Guardar de todas formas») cuando el nivel terminal no tiene atributos, explicando que el alta usará la dimensión por defecto (Talla).
    * **Doc ampliada:** nueva sección 8 (cómo se genera una plantilla: estructura `hierarchyTreeJson`, interpretación en el alta, invariantes) y sección 9 (metodología de análisis de productos: levantamiento, árbol de decisión, traducción a niveles, elección de tipos de dato, errores comunes y checklist previa).
    * **Verificación:** build frontend limpio; único aviso de lint restante es preexistente (`setState` en efecto de carga).
  - **Catálogo — Alineación del Generador de Plantillas con Atributos Tipados y `photoScope` (`HierarchyTemplateTreeBuilder.tsx`, `ProductTemplatesListPage.tsx`) [sin bump de versión]:**
    * **Selector de atributos:** ya no muestra la clasificación antigua (`size/color/custom`); ahora indica **tipo de dato + rol** (`Variantes` / `Descriptivo`) y unidad: ej. `Caña · Texto · Variantes`.
    * **Chips de atributos:** incorporan badge verde **Variantes** o ámbar **Descriptivo** con tooltip del tipo y unidad, para entender por qué un atributo no genera SKUs.
    * **Pills de fotos:** reemplazan el genérico «Foto» por el alcance real: **Foto: Modelo / Grupo / Variante** (en vista pizarra y lista anidada).
    * **Simulación de desglose real:** se eliminó el texto hardcodeado (Talla + Color, ejemplos fijos, solo 2–3 niveles); ahora recorre los niveles reales, muestra cada atributo con su rol, los **ejes de SKU efectivos** y el **alcance de fotos resuelto**.
    * **Listado de plantillas:** el icono de cámara refleja el alcance de fotos por nivel en su tooltip.
    * **Verificación:** build frontend limpio, lint sin errores en los archivos tocados y specs de plantillas compilando.
  - **Documentación Funcional — Catálogo, Inventario y Ecommerce (`doc/modulo-catalogo-inventario-ecommerce.md`) [sin bump de versión]:**
    * Guía funcional completa: modelo de 3 capas (catálogo → inventario → ecommerce), piezas del catálogo (categorías, diccionario tipado, plantillas con `photoScope`, producto, variante), flujo de alta paso a paso.
    * **6 ejemplos de ingreso:** calcetines (caña × talla con fotos por grupo/modelo), camisetas (color × talla), ferretería (medida numérica con unidad y color descriptivo), producto simple, servicio y variante con código de barras + stock inicial.
    * Inventario (documentos de ingreso/egreso/traspaso/ajuste, kárdex promedio ponderado, disponible = cantidad − reservada), ciclo de pedidos ecommerce (reserva al crear, commit al despachar, liberación al cancelar), bondades, límites actuales/hoja de ruta, glosario y anexo de rutas.
    * Afirmaciones verificadas contra el código (CreateEcommerceOrder reserva, ShipEcommerceOrder comitea, CancelEcommerceOrder libera; ReceivePurchase crea y aprueba documento `Receipt` origen `Purchase`).
  - **Catálogo Fase 2-C — Fotos de Grupo Deduplicadas y Herencia Grupo→Modelo (`CatalogItemImage.cs`, migración `AddCatalogItemImageGroupValue`, `UploadCatalogItemImage*`, `GetCatalogItemHandler.cs`, `VariantMatrixBuilder.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`) [sin bump de versión]:**
    * **Esquema:** `catalog.item_images.group_value` (varchar 120, nullable, índice por ítem+grupo); `null` = imagen del modelo, con valor = foto compartida de esa variación.
    * **Subida única:** el endpoint de imágenes acepta `groupValue`; en alcance «Compartidas por grupo» el constructor guarda las fotos en un mapa por grupo (`onChange.groupImages`) y la creación las sube **una sola vez** al producto matriz, sin replicar ni subir N veces.
    * **Resolución en lectura:** la variante usa su foto propia → foto de su grupo (coincidencia por la dimensión principal y el valor del atributo) → foto del modelo; se expone `ImageInheritedFrom` (`group`/`model`).
    * **UI de edición:** la columna Foto marca «G» (compartida de grupo) o «M» (heredada del modelo).
    * **Verificación:** 432/432 tests backend en verde (270 Core + 162 Business; 2 nuevos: persistencia de `groupValue` y resolución grupo→modelo), modelo/migración sincronizados, build frontend limpio y sin errores nuevos de lint.
    * **Pendiente:** aplicar el mismo resolvedor de herencia en la vitrina Ecommerce; vinculación de plantillas por ID de atributo (opcional).
  - **Catálogo Fase 2-B — `photoScope` y Herencia de Imagen del Modelo (`HierarchyTemplateTreeBuilder.tsx`, `ProductTemplateBuilderPage.tsx`, `catalogArchetype.ts`, `CreateCatalogItemPage.tsx`, `VariantMatrixBuilder.tsx`, `GetCatalogItemHandler.cs`, `EditCatalogItemVariantsSection.tsx`) [sin bump de versión]:**
    * **photoScope por nivel:** la plantilla declara dónde se capturan las fotos (`Sin fotos`, `Por variante (SKU)`, `Compartidas por grupo`, `Del modelo`); gana el alcance más consolidado (`model > group > variant`) y `hasImages` se mantiene sincronizado para compatibilidad.
    * **Flujo de alta:** con alcance de modelo la galería del padre se habilita incluso con variantes y las fotos se suben una sola vez al producto matriz; con alcance de grupo se usa la barra compartida y se oculta la foto por fila; con variante se mantiene la foto por SKU.
    * **Herencia en lectura:** `GetCatalogItem` resuelve la imagen principal del modelo para variantes sin foto propia (`ImageInherited = true`), sin duplicar registros ni archivos; la edición muestra la miniatura con la marca «M» (heredada).
    * **Constructor de plantillas:** el toggle «Fotografías por elemento» se reemplaza por un selector de alcance; los niveles nuevos usan `model` en el nivel de modelo y `variant` en el terminal.
    * **Verificación:** 430/430 tests backend en verde (269 Core + 161 Business; 2 tests nuevos de herencia), build frontend limpio y limpieza de lint (ids de nivel extraídos a helper puro).
    * **Pendiente 2-C (si se requiere):** media compartida real (asset único referenciado por grupo/variante), deduplicación de fotos de grupo (hoy se replican al subir) y vinculación de plantillas por ID de atributo.
  - **Catálogo Fase 2-A — Atributos Tipados y Candado de Plantilla en Uso (`VariantDimensionTemplate.cs`, migración `AddVariantAttributeTyping`, `catalogArchetype.ts`, `ArchetypeModelFields.tsx`, `CatalogAttributesListPage.tsx`, `ProductTemplatesListPage.tsx`, handlers) [sin bump de versión]:**
    * **Diccionario tipado:** `VariantDimensionTemplate` incorpora `DataType` (`text|number|boolean|color`), `IsVariantAxis` (eje con SKU vs descriptivo del modelo) y `Unit` (unidad opcional); migración con defaults y backfill de escalas con semántica de color; escalas del sistema tipadas.
    * **UI por tipo:** `ArchetypeModelFields` renderiza según `dataType` (ColorPicker, NumberBox, Select Sí/No, Select de opciones o TextBox) e incluye la unidad en la etiqueta; el constructor de variantes respeta el color tipado aunque el nombre no contenga «color» (`DimensionState.isColor`).
    * **isVariantAxis:** `getModelAttributeFields`/`getVariantDimensionFields` separan modelo y ejes por metadato tipado (heurística por nombre solo como respaldo); un color `isVariantAxis=false` deja de generar SKUs y se captura como atributo del modelo.
    * **Gestión del diccionario:** el modal de Atributos agrega Tipo de dato, Uso en variantes y Unidad; la grilla muestra tipo, unidad y la marca «Solo descriptivo».
    * **Candado de plantilla:** el listado expone `usageCount` con badge «N productos / Sin uso» y bloquea la eliminación en uso (backend `catalog.product_template.delete.in_use`, con FK `SET NULL` como respaldo).
    * **Verificación:** 428/428 tests backend en verde (269 Core + 159 Business; 4 tests nuevos), modelo y migración sincronizados, build frontend limpio y sin errores nuevos de lint.
    * **Pendiente Fase 2-B:** `photoScope` (model/group/variant) + media compartida sin duplicar y vinculación de plantillas por ID de atributo.
  - **Catálogo — Fotografía por Variante (SKU) (`VariantMatrixBuilder.tsx`, `variantMatrixBuilder.css`, specs UI) [sin bump de versión]:**
    * **Foto por fila:** cada variante/SKU incorpora su propia columna «Foto» con subida múltiple, miniatura, contador `+N` y remoción, independiente de las fotos compartidas.
    * **Barra compartida condicionada:** las «Fotos compartidas del grupo» solo se muestran cuando existe una dimensión principal real (color/caña); con una sola dimensión (Talla → grupo «General») cada SKU gestiona su propia imagen.
    * **Payload sin cambios:** `stagedImages` por variante ya se enviaba al backend; ahora es gestionable desde la interfaz.
    * **Specs Playwright actualizados:** foto por variante, alta de talla en fila y botón duplicar fila.
    * **Verificación:** build frontend limpio; sin errores de lint nuevos; specs compilan y se listan.
  - **Catálogo — ColorPicker de glubox en la Dimensión Color (`VariantMatrixBuilder.tsx`) [sin bump de versión]:**
    * **Swatch editable:** el círculo de color de cada tarjeta de grupo ahora es un botón que abre un `Popup` con el `ColorPicker` de glubox (input hex, panel HSV y presets) para definir la muestra cromática.
    * **Nuevo color con picker:** al elegir «+ Nuevo Color…» ya no se usa `window.prompt`; se abre el modal con nombre + `ColorPicker`.
    * **Duplicar color con picker:** «Duplicar Color» sin valores restantes abre el mismo modal (nombre + color) en lugar del prompt.
    * **Estado:** `colorHexMap` pasó a ser mutable (`setColorHexMap`); al renombrar o duplicar, el hex se traslada del valor origen al destino.
    * **Limitación:** el mapa hex es de sesión (no persiste en backend); puede guardarse en `customAttributesJson` si se requiere.
    * **Verificación:** build frontend limpio; sin errores de lint nuevos.
  - **Catálogo — SKU Manual (sin generación automática) (`VariantMatrixBuilder.tsx`, `EditCatalogItemVariantsSection.tsx`, `CreateCatalogItemPage.tsx`) [sin bump de versión]:**
    * **Sin autogeneración:** la fila inicial, «Duplicar variante», «Añadir talla al grupo» y «Duplicar grupo» ahora arrancan con el campo SKU vacío y obligatorio para ingreso manual del usuario.
    * **Modal de alta de variante:** ya no prellena ni autosugiere el SKU con el prefijo del modelo al cambiar dimensiones; se conserva la sugerencia automática del título.
    * **Purga (Regla 10):** eliminados los helpers `getVariantSkuPrefix`/`sanitizeSkuPart`, el flag muerto `isManualSku` y el prop `baseSku` del constructor; placeholder del campo actualizado («Ej. NIK-001-0001») y tarjeta renombrada a «SKU del Modelo».
    * **Verificación:** build frontend limpio; sin errores de lint nuevos.
  - **Catálogo — Specs Playwright Actualizados al Flujo Actual (`catalogo-ui.spec.ts`, `producto-matriz-ui.spec.ts`, `plantillas-producto-ui.spec.ts`) [sin bump de versión]:**
    * **Selectores y copy alineados a la UI v0.41+:** «Ítems del Catálogo», «Categorías del Catálogo», «Fotografías del Producto», tarjetas de variantes por dimensión (`.ecu-variant-group-card`, `.ecu-variant-sub-item-row`), fotos compartidas por grupo, «Configuración de Niveles Jerárquicos» y «Diagrama Visual de Jerarquía (Vista Pizarra)».
    * **Interacción correcta con glubox `Select`:** se usa el rol `combobox` + `option` (el componente no es un `<select>` nativo, por lo que `selectOption` no aplica).
    * **Tolerancia a límites de plan:** el flujo de plantillas navega por URL si «Nueva Plantilla» está deshabilitado por límite de tier.
    * **Verificación:** los 8 tests compilan, se listan con Playwright y se ejecutan como `skipped` sin credenciales; la corrida real queda pendiente de `E2E_EMAIL`/`E2E_PASSWORD` en `ecunexo_admin/.env.local` con el stack API+DB arriba.
  - **Catálogo — Consumo Proactivo de Límites en la UI (`useCatalogLimits.ts`, `authSlice.ts`, `ProductTemplatesListPage.tsx`, `ProductTemplateBuilderPage.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`) [sin bump de versión]:**
    * **Sesión:** `authSlice` ahora persiste `resolvedLimits` (del tenant o de la suscripción) y expone `selectResolvedLimits`; nuevo hook `useCatalogLimits` con `maxVariants`, `maxActiveVariants` y `maxProductTemplates`.
    * **Plantillas:** el listado deshabilita «Nueva Plantilla» al alcanzar el máximo con banner informativo, y el constructor bloquea la creación por URL directa con aviso y redirección.
    * **Variantes:** la creación de ítems muestra el cupo disponible y bloquea el guardado si se configuran más variantes que las disponibles; la edición de matriz deshabilita «Añadir Variante» al agotar el cupo.
    * **Higiene:** corregidos los `useHasPermission` condicionales en las páginas de Plantillas (listado y constructor).
    * **Verificación:** build frontend limpio (`tsc -b && vite build`); sin errores de lint nuevos (los restantes en archivos tocados son preexistentes).
  - **Catálogo — Enforcement de Límites de Tier (`CatalogTierLimits.cs`, `SessionLimitResolver.cs`, `CreateCatalogItemMatrixHandler.cs`, `AddCatalogItemVariantHandler.cs`, `UpdateCatalogItemHandler.cs`, `CreateProductTemplateHandler.cs`, repositorios) [sin bump de versión]:**
    * **Guard de Límites (`CatalogTierLimits`):** resuelve los límites del entitlement `catalog` (`max_variants`, `max_active_variants`, `max_product_templates`); un tenant sin entitlements (legacy) queda sin restricción.
    * **Matrices y Variantes:** la creación de matrices y el alta de variantes bloquean con error 403 `catalog.variants.limit_reached` / `catalog.variants.active_limit_reached` al superar los límites total/activo, contando variantes reales en base de datos (`CountVariantsAsync`).
    * **Reactivación de Variantes:** `UpdateCatalogItemHandler` valida el límite de activas al pasar una variante de Inactivo a Activo.
    * **Plantillas de Producto:** `CreateProductTemplateHandler` bloquea con `catalog.product_templates.limit_reached` según `max_product_templates`.
    * **Sesión:** `SessionLimitResolver` ahora expone los límites de `catalog` (se eliminó el skip que asumía que el módulo no tenía límites numéricos), quedando disponibles para la UI.
    * **Verificación:** 425/425 tests backend en verde (267 Core + 158 Business) con 4 tests nuevos de límites (matriz, alta de variante, reactivación y plantilla).
    * **Pendiente:** consumo proactivo de límites en la UI (deshabilitar acciones según sesión) y actualización de specs Playwright.
  - **Catálogo Fase 1.5 — Creación y Edición Guiadas por Arquetipo (`lib/catalogArchetype.ts`, `ArchetypeModelFields.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemPage.tsx`, `VariantMatrixBuilder.tsx`) [sin bump de versión]:**
    * **Librería Compartida (`lib/catalogArchetype.ts`):** `isColorDimension`, `buildDimensionValuesMap` (diccionario + sinónimos), `getModelAttributeFields` (atributos de niveles intermedios excluyendo talla/color), `getVariantDimensionFields` (nivel terminal + color de niveles intermedios) y `buildHierarchyPathJson`; elimina la lógica duplicada entre creación y edición y centraliza la semántica jerárquica.
    * **Componente `ArchetypeModelFields`:** renderiza `<Select>` alimentados por el Diccionario Maestro (o `<TextBox>` cuando no hay escala) para los atributos del modelo, con etiqueta del nivel de origen (`N1 · Colección / Familia`).
    * **Creación:** el modo plantilla vuelve a capturar los atributos del modelo en el producto padre (alimentando `hierarchyPathJson`), mientras que las variantes físicas se restringen a los ejes del nivel terminal más los colores de niveles intermedios; copy de la tarjeta actualizado.
    * **Edición:** cuando el ítem tiene familia, se cargan plantilla y diccionario, se muestra la tarjeta «Modelo del Arquetipo» con los campos guiados prellenados, y al guardar se recalcula `hierarchyPathJson` (con fallback al valor existente del ítem).
    * **Verificación:** build frontend limpio (`tsc -b && vite build`); los 6 avisos de lint restantes en los archivos tocados son preexistentes.
    * **Pendiente:** actualizar specs Playwright al flujo guiado; enforcement de límites de tier.
  - **Catálogo Fase 1 — Arquetipo Persistente y Ruta Jerárquica (`CatalogItem.cs`, migración `AddCatalogItemFamilyAndHierarchyPath`, `CatalogEndpoints.cs`, `CreateCatalogItemPage.tsx`, `EditCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`) [sin bump de versión]:**
    * **Dominio:** `CatalogItem.FamilyId` (FK a `catalog.product_templates` con `ON DELETE SET NULL`) y `HierarchyPathJson` jsonb canónico `[{ level, name, value }]`; normalizador `NormalizeHierarchyPath` (recorta, descarta entradas incompletas, máx. 12 niveles); las variantes heredan familia y ruta del producto matriz (`CreateVariantChild`).
    * **Persistencia:** migración EF con GIN `ix_items_hierarchy_path_json`, índice parcial multi-tenant `ix_items_tenant_id_family_id` (filtro `deleted_at IS NULL`) y FK `fk_items_product_templates_family_id`.
    * **API/CQRS:** `FamilyId` + `HierarchyPathJson` en create, matrix y update (validación `catalog.item.family.not_found` / `catalog.matrix.family.not_found`); listado y detalle exponen `FamilyId`, `FamilyName` y `HierarchyPathJson`.
    * **Frontend:** la creación envía familia + ruta jerárquica construida desde los niveles intermedios del arquetipo y los atributos capturados; la edición muestra el banner «Arquetipo» con chips de la ruta y preserva familia/ruta al guardar y al sincronizar precios de variantes.
    * **Verificación:** 421/421 tests backend en verde (267 Core + 154 Business; 7 tests nuevos de normalización de ruta, herencia y validación de familia) y build frontend limpio (`tsc -b && vite build`).
    * **Pendiente:** edición guiada por arquetipo en el formulario (re-render de niveles desde la familia), enforcement de límites de tier, actualización de specs Playwright.
  - **Estabilización del Catálogo — Fase 0: Contrato de Dimensiones, Permisos Canónicos y Purga de Deuda (`VariantMatrixBuilder.tsx`, `CatalogItem.cs`, `CatalogEndpoints.cs`, `MenuCatalogSeedData.cs`, `DashboardPage.tsx`, `catalogAttributes.ts`) [sin bump de versión]:**
    * **Contrato Único de Dimensiones:** `VariantMatrixBuilder.tsx` ahora emite el arreglo canónico (`[{name, values}]`) que exige el dominio; `CatalogItem.NormalizeVariantDimensions` además tolera el formato envuelto `{"dimensions":[...]}` y lo canoniza, eliminando el fallo `catalog.matrix.dimensions.array` en la creación de matrices. 3 tests nuevos en `ProductMatrixItemTests.cs` (arreglo canónico, formato envuelto, forma inválida rechazada).
    * **Reconciliación RBAC:** Retirado el permiso legacy `catalog.product.*` de endpoints, menú y frontend; `catalog.matrix.read/create/update` ahora son aceptados por los endpoints de lectura/creación de matrices; corregidos los tiles del Dashboard que usaban `catalog.items.*` (plural inexistente) y la paleta de comandos que referenciaba `catalog.product.create`.
    * **Purga de Código Muerto (Regla 10):** Eliminados componentes huérfanos `CatalogExtraAttributeFields.tsx`, `CatalogAttributeColorsField.tsx` y su CSS; helpers sin uso en `lib/catalogAttributes.ts` (`parseAttributeValues`, `serializeAttributeValues`, `missingRequiredAttributeLabel`, `isColorAttributeField`, `parseColorList`, `serializeColorList`, `isHexColor`); métodos de dominio `AddVariantChild` y `UpdateMatrixDimensions`; repositorio `ListVariantsByParentIdAsync`; y el catálogo de escalas hardcodeado (`sys-1..sys-5`) de `CreateCatalogItemPage` (la BD siembra las escalas reales).
    * **Verificación:** 413/413 tests backend en verde (261 Core + 152 Business) y build frontend limpio (`tsc -b && vite build`).
    * **Pendientes de la fase:** aplicar límites de tier (`max_variants`, `max_product_templates`) usando `SessionLimitResolver`/`Tenant.ModuleEntitlements`; actualizar specs Playwright desfasados (`producto-matriz-ui.spec.ts`, `catalogo-ui.spec.ts`, `plantillas-producto-ui.spec.ts`); siguiente hito Fase 1 (persistir `family_id` + `hierarchy_path` en `CatalogItem`).

  - **Enfoque A: Tarjetas Agrupadas por Dimensión Principal (Color/Grupo) con Tallas Físicas y Fotos Compartidas (`VariantMatrixBuilder.tsx`, `CreateCatalogItemPage.tsx`, `variantMatrixBuilder.css`, `AboutAppModal.tsx`) [v0.41.0]:**
    * **Arquitectura Jerárquica de Variantes (Enfoque A):** Las variantes físicas se agrupan visualmente por su dimensión principal (Color o Presentación), resolviendo la relación multidimensional entre dimensiones y variantes.
    * **Fotografías Compartidas por Color:** Las fotos se gestionan y suben a nivel del Color/Grupo (barra integrada con miniaturas + botón `+ Subir Fotos` y modal de gestión), compartiéndose automáticamente a todas las tallas de ese color y propagándose a `stagedImages[]`.
    * **Filas Compactas de Tallas (Sub-items):** Dentro de cada tarjeta de color, las tallas (dimensiones secundarias) se gestionan como filas claras y ágiles con su selector de talla, SKU inmutable, tags/actividad, precio base heredado, stock inicial, código de barras y botones para duplicar o eliminar talla.
    * **Duplicación de Grupo en 1 Clic:** Botón `Duplicar Color` en el encabezado del grupo para clonar instantáneamente todas las tallas a un nuevo color sin recaptura manual.
    * **Limpieza de Secciones Redundantes y Eliminación de Código Muerto:**
      - Removidas las secciones sin sentido en `CreateCatalogItemPage`: "Etiquetas de Clasificación y Búsqueda (Tags)" a nivel producto y "04 Especificaciones y Atributos Adicionales", así como el selector duplicado "Dimensiones del Modelo".
      - Unificada la captura de dimensiones de la plantilla en `templateAllDimensions` que fluye directamente a las tarjetas de variantes.
      - Eliminado el botón duplicado de "Agregar Variante" (ahora 1 botón primario en barra superior para `Añadir Color / Variante` y botones secundarios en el footer de cada tarjeta para `Añadir Talla`).
      - Preservación estricta de SKU según instrucciones del usuario (el SKU no se recrea automáticamente al cambiar dimensiones).
    * **Desacoplamiento de la Explosión Cartesiana:** Se reemplazó la generación cartesiana forzada y automática por creación bajo demanda. El comerciante agrega variantes físicas con el botón `+ Agregar Variante` o `Duplicar` (`<Copy />`), o genera combinaciones completas únicamente si lo desea mediante el botón explícito `Combinar Opciones`.
    * **Selectores de Dimensión por Fila:** Las dimensiones en la tabla ya no son texto estático inmutable. Cada fila de variante cuenta con menús desplegables (`<select className="ecu-matrix-dim-select">`) para cada dimensión activa (Talla, Color, Caña, etc.), permitiendo seleccionar el valor exacto para esa variante física con swatch de color y actualización automática de título y SKU.
    * **Supresión de Columna "Actividad / Uso" Duplicada:** Se eliminó la columna fija y redundante de actividad en la tabla y en `customAttributesJson`, evitando duplicidad con las especificaciones del modelo o tags.
    * **Tags / Especificaciones Editables por Variante:** Cada fila de variante cuenta con su campo de texto propio para ingresar tags o actividad específica (`#running`, `#crossfit`, `Verano`), combinándose reactivamente con los tags del padre y las dimensiones seleccionadas en badges visuales y serializándose en `customAttributesJson.tags`.
  - **Catálogo Basado en Plantillas y Fotografía Exclusiva en Variantes (`CreateCatalogItemPage.tsx`, `VariantMatrixBuilder.tsx`, `AboutAppModal.tsx`) [v0.40.2]:**
    * **Formulario 100% Guiado por Plantilla:** Supresión de campos redundantes (`Categoría`, `Nombre manual`, `Precio base referencial`, `Descripción`) al elegir una plantilla, listando directamente las dimensiones intermedias del modelo en la tarjeta superior mediante selectores (`<Select>`) asistidos del Diccionario Maestro.
    * **Fotografías Exclusivas en Variantes:** Eliminación de la zona de subida de imágenes a nivel producto cuando existen variantes (las fotos se gestionan exclusivamente en las variantes físicas).
    * **Zona de Carga Directa en Variantes:** Zona de subida directa (drag & drop / clic) en el modal de variante individual y en la asignación masiva por lote, retirando cualquier mención a "vitrina principal".
  - **Consolidación de Atributos del Modelo, Galería Única de Fotos y Matriz Física de Variantes (`CreateCatalogItemPage.tsx`, `VariantMatrixBuilder.tsx`, `AboutAppModal.tsx`) [v0.40.1]:**
    * **Especificaciones del Modelo en `<Select>`:** Todos los atributos definidos en niveles intermedios de la jerarquía (ej. Caña, Actividad, Disciplina, Material) se consolidan en una sola tarjeta clara, renderizados con menús desplegables (`<Select>`) prealimentados automáticamente con opciones y sinónimos del Diccionario Maestro de Atributos.
    * **Galería Única de Fotos de Presentación:** Se eliminaron definitivamente las zonas de carga de fotos repetidas por nivel jerárquico intermedio. El producto cuenta con exactamente 1 zona de carga de fotografías de vitrina comercial disponible para vincular a variantes.
    * **Matriz Terminal de Variantes Físicas:** El constructor de matriz (`VariantMatrixBuilder`) al pie del formulario se restringe exclusivamente a las variaciones físicas reales de inventario (Talla × Color) con generación automática de SKUs descriptivos y preselección de 1 variante inicial.
  - **Flujo Jerárquico Nivel por Nivel, Selección Asistida de Atributos y Fotos por Escala (`CreateCatalogItemPage.tsx`, `StagedCatalogItemImages.tsx`, `VariantMatrixBuilder.tsx`) [v0.40.0]:**
    * **Desglose Nivel por Nivel en Creación de Ítems:** El formulario de alta de productos ahora se despliega ordenadamente según los niveles de la plantilla jerárquica (ej. Nivel 1: Familia ➔ Nivel 2: Modelo ➔ Nivel 3: Variantes Físicas al final).
    * **Atributos de Niveles Superiores con `<Select>`:** Los atributos definidos en la plantilla (ej. Caña, Actividad, Composición, Material) se renderizan como menús desplegables (`<Select>`) cargados en 1 clic directamente del Diccionario Maestro de Atributos (`VariantDimensionTemplateDto`).
    * **Fotografías por Nivel Jerárquico:** La subida de imágenes se ubica directamente dentro del nivel al que pertenecen (ej. Nivel Modelo para fotos de presentación), eliminando la tarjeta flotante y el banner interior duplicado (`hideBanner`).
    * **Variaciones Físicas al Final del Formulario:** La matriz de variantes (`VariantMatrixBuilder`) se ubica en el último escalón del flujo (Nivel Terminal), con inicialización automática de dimensiones terminales, sin preguntar si tiene variantes cuando hay plantilla, y con generación descriptiva de SKUs (`skuFormat = 'name'`).
  - **Columnas por Dimensión, Múltiples Fotografías por Variante Física y Optimización de SKU (`VariantMatrixBuilder.tsx`, `CreateCatalogItemPage.tsx`, `variantMatrixBuilder.css`, `StagedCatalogItemImages.tsx`) [v0.39.1]:**
    * **Columnas Dedicadas por Dimensión en Matriz:** En lugar de agrupar características bajo un encabezado único «Variación», cada dimensión activa (ej. Caña, Talla, Color) cuenta con su propia columna dedicada en el `<thead>` y celdas individuales en el `<tbody>`, incluyendo swatches de color y alineación limpia.
    * **Múltiples Fotografías por Variante Física (SKU):** Soporte para asignar múltiples imágenes por variante (`stagedImages[]`). Selector de archivos con atributo `multiple`, modal de gestión con grilla de fotos asignadas (marcador «Principal» y botón de remoción individual), selector tipo toggle en galería general de vitrina, y badge contador (`+N`) en la celda de la tabla.
    * **Carga en Lote al Backend:** Al dar de alta el producto, el backend sube todas las fotografías de cada variante hija a través del endpoint de imágenes.
    * **Inicialización Limpia y Supresión de SKU Padre:** La matriz arranca por defecto con una única variante inicial física en lugar de tres. Se oculta el campo SKU en el producto padre cuando se habilitan variantes físicas, asignando códigos SKU exclusivamente al nivel terminal (variantes).
  - **Fotografías por Variante, Asignación Masiva y Arquitectura de Catálogo (`VariantMatrixBuilder.tsx`, `MenuCatalogSeedData.cs`) [v0.39.0]:**
    * Asignación visual de fotografías independientes por variante física, ranuras interactivas de previsualización, modal de asignación en lote por característica, retiro definitivo del módulo obsoleto de Categorías y placeholders genéricos normalizados en todo el catálogo.
  - **Ergonomía de Selección Instantánea y Modernización Visual en Plantillas (`HierarchyTemplateTreeBuilder.tsx`, `ProductTemplateBuilderPage.tsx`):**
    * **Adición Automática en 1 Clic:** Al seleccionar cualquier atributo del diccionario corporativo en el menú desplegable, se añade inmediatamente como chip/etiqueta activa al nivel sin requerir presionar el botón `+`, reiniciando automáticamente el desplegable para una carga ágil continua.
    * **Paleta M3 Enterprise SaaS Refinada:** Sustituido el contenedor gris opaco (`rgba(0,0,0,0.15)`) por superficies suaves con tintado primario semántico (`color-mix`), bordes de alta definición y contraste cromático óptimo tanto en modo claro como oscuro.
    * **Limpieza Absoluta de Presets Fijos:** Eliminada cualquier plantilla fija predeterminada para que el usuario diseñe y cree sus arquetipos y taxonomías con total autonomía desde cero.
  - **Reasignación Flexible de Variantes y Registro Inmutable de Auditoría (`CatalogItem.cs`, `ReassignCatalogItemVariantParent`, `EditCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`):**
    * **Dominio & Reglas de Invarianza (`CatalogItem.ReassignParent`):** Permite trasladar una variante física de un producto matriz a otro, o independizarla (`targetParent = null`), conservando el 100% de su SKU, código de barras, facturación histórica SRI y stock en bodega (unidades físicas y kárdex).
    * **Trazabilidad Inmutable en JSONB (`parent_reassignment_history`):** Cada reasignación exige un motivo obligatorio (mínimo 3 y máximo 500 caracteres) y registra en auditoría: timestamp UTC, usuario, motivo, ID/nombre/SKU del padre anterior y del padre destino. La función `CatalogItem.Update` preserva automáticamente este historial para evitar sobreescrituras accidentales.
    * **Capa de Negocio CQRS:** Comando `ReassignCatalogItemVariantParentCommand`, validador FluentValidation y handler registrados en `DependencyInjection.cs`, con endpoint `POST /api/v1/tenants/{tenantId}/catalog/items/{itemId}/reassign-parent` protegido por `catalog.item.update`.
    * **Experiencia de Usuario en Frontend:**
      - En `EditCatalogItemPage.tsx`: Banner de variante con botón «Mover / Reasignar Variante», banner en productos independientes para vincularlos a una matriz, modal interactivo de selección de destino y motivo, y tarjeta dedicada *Historial de Reasignaciones (Auditoría)* con línea de tiempo y traslados visuales.
      - En `EditCatalogItemVariantsSection.tsx`: Acción directa en la grilla de variantes de la matriz padre (`ArrowLeftRight`) para mover cualquier variante sin salir de la vista.
    * **Suite de Pruebas Automatizadas:** 410 tests en verde (258 en `EcuNexo.Core.UnitTests` y 152 en `EcuNexo.Business.UnitTests`) con cobertura de casos positivos, rechazo por motivo corto, cross-tenant, auto-asignación y destinos inválidos; y compilación de producción frontend limpia (`tsc -b && vite build` en 1.69s).
  - **Tags Jerárquicos en Catálogo, Variantes Dimensionales y Limpieza de Plantillas de Prueba (`EcuTagInput.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemPage.tsx`, `VariantMatrixBuilder.tsx`, `HierarchyTemplateTreeBuilder.tsx`):**
    * **Componente de Entrada de Etiquetas (`EcuTagInput.tsx`):** Input interactivo de tags/etiquetas tipo chip con prefijo `#`, soporte para teclado (`Enter`, `,`, `Backspace`), sugerencias automáticas basadas en categoría y especificaciones de atributos, prevención de duplicados insensible a mayúsculas y conteo dinámico.
    * **Herencia y Acumulación Jerárquica de Tags:** Los tags registrados en el producto matriz (ej. `#Nike`, `#Algodon`, `#Antideslizante`, `#Tennis`) se heredan a todas las variantes físicas generadas en el constructor de matriz. A su vez, cada variante combina los tags superiores con sus propias dimensiones físicas (`#CanaCorta`, `#Talla10-12`) y especificaciones secundarias (`#Running`, `#Crossfit`), permitiendo búsquedas hiperprecisas tanto en Punto de Venta (POS) como en vitrina e-commerce.
    * **Visualización de Tags en Grilla de Variantes:** Nueva columna *Tags Jerárquicos* en el constructor de matriz que exhibe visualmente en tiempo real los tags acumulados por SKU.
    * **Limpieza de Plantillas de Prueba y Presets Mock:** Eliminada la sección de plantillas de prueba y presets mock (`TEMPLATE_PRESETS`: calcetería, calzado, confección, electrónica) de `HierarchyTemplateTreeBuilder.tsx` y `ProductTemplateBuilderPage.tsx`, garantizando una interfaz completamente limpia donde cada empresa crea sus propios arquetipos desde cero.
    * **Pruebas y Verificación:** 395/395 tests unitarios en .NET 10 superados con 0 fallas, pruebas de UI Playwright actualizadas en `producto-matriz-ui.spec.ts` y compilación frontend limpia con Vite en 1.56s.
  - **Variantes Dimensionales con Identificador Jerárquico y Herencia Polimórfica de Precios/Descuentos (`VariantMatrixBuilder.tsx`, `CatalogItem.cs`, `CatalogAttributeSchema.cs`):**
    * **Identificador Jerárquico de SKUs (`PADRE-0001`):** Incorporado selector de formato de SKU en el constructor de variantes: modo *Jerárquico Numérico* (`NIK-001-0001`, `NIK-001-0002` con relleno a 4 dígitos) y modo *Por Atributos* (`PADRE-CORTA-BLA`), sincronizando reactivamente los códigos de cada variante con el prefijo del producto matriz padre.
    * **Herencia Automática de Precios y Descuentos:** El precio base del producto matriz (`basePrice`) se hereda por defecto a cada combinación en la grilla y en el backend (`basePrice ?? parent.BasePrice`), con indicador visual verde `Heredado ($X.XX)` y soporte de sobreescritura manual por variante.
    * **Fusión de Atributos Padre ➔ Hijo (`CatalogAttributeSchema.MergeAttributes`):** Cualquier atributo o descuento del padre (`descuento`, `marca`, `material`, `tipo`) se hereda automáticamente a las variantes hijas. Si la variante define un valor para un campo con el mismo nombre (`campo se llame igual`), el valor de la variante tiene precedencia (override).
    * **Columna «Actividad / Uso» en Grilla de Variantes:** Permite definir especificaciones secundarias por variante (ej. *Running*, *Skater*, *Crossfit*) que se serializan en el `customAttributesJson` de cada SKU hijo.
    * **Suite de Pruebas Rigurosa:** 395/395 tests unitarios en verde en `dotnet test` (incluyendo 3 nuevas pruebas específicas de herencia y sobreescritura en `ProductMatrixItemTests.cs`), tests UI actualizados en `producto-matriz-ui.spec.ts` y compilación frontend limpia (`vite build` en 1.51s).
  - **Experiencia de Usuario Avanzada en Constructor de Plantillas (`HierarchyTemplateTreeBuilder.tsx`, `ProductTemplateBuilderPage.tsx`):**
    * **Presets Rápidos en 1 Clic:** Barra interactiva con 4 presets canónicos (*Calcetería & Medias Deportivas 3N*, *Calzado Deportivo 3N*, *Confección Textil 3N*, *Producto Simple 2N*) que autocompletan la estructura jerárquica y el nombre recomendado al instante.
    * **Diagrama Visual de Pizarra / Mindmap Canvas:** Vista previa interactiva con cuadrícula técnica de nodos conectados por flechas direccionales, insignias de capacidades (ColorPicker, Fotos) y caja de simulación viva de desglose en catálogo que reproduce fielmente el modelo de pizarra conceptual.
    * **Sugerencias Inteligentes de Atributos y Clonación de Niveles:** Botones de adición rápida en 1 clic para atributos recomendados del diccionario y botón de clonar nivel (`Copy`) para duplicar configuraciones complejas.
    * **Verificación:** Compilación frontend limpia (`vite build` en 1.34s) y 392/392 tests backend en verde.
  - **Corrección de Eliminación de Atributos en PostgreSQL (`CatalogItemRepository.cs`):**
    * **Resolución de Error 500 en Eliminación de Atributos:** Se corrigió `IsAttributeTemplateInUseAsync` para delegar la verificación en `GetInUseAttributeTemplateNamesAsync`, eliminando el uso inválido de `EF.Functions.ILike` sobre columnas `jsonb` (`custom_attributes_json` y `variant_dimensions_json`) que provocaba la excepción de PostgreSQL `42883: operator does not exist: jsonb ~~* unknown`.
    * **Consistencia 100% UI y Backend:** La lógica de validación previa al borrado ahora utiliza exactamente la misma inspección que alimenta los badges "Sin Registros / Base" y "En Uso" en la interfaz (`/catalogo/atributos`).
    * **Suite de Pruebas:** 392/392 tests unitarios en verde en `dotnet test` y compilación de frontend verificada con `npm run build`.
  - **Fábrica de Plantillas Jerárquicas de Producto y Arquetipos Multinivel (`ProductTemplate.cs`, `ProductTemplatesListPage.tsx`, `ProductTemplateBuilderPage.tsx`, `HierarchyTemplateTreeBuilder.tsx`):**
    * **Modelo de Dominio y Persistencia Eficiente:** Entidad `ProductTemplate` (`AggregateRoot<Guid>`) en `EcuNexo.Core/Catalog` con estructura de niveles almacenada en columna `jsonb` (`HierarchyTreeJson`) e indexada con método `gin` en PostgreSQL para consultas ultrarrápidas sin alterar el esquema relacional ante cualquier profundidad ($N$ niveles).
    * **Capa de Negocio CQRS y Validación:** Comandos `CreateProductTemplate`, `UpdateProductTemplate`, `DeleteProductTemplate` y queries `ListProductTemplates`, `GetProductTemplateById` con validadores FluentValidation, unicidad por nombre insensible a mayúsculas con `EF.Functions.ILike` y 11 tests unitarios nuevos (5 Core + 6 Business, total 392 tests en verde).
    * **Endpoints REST y Menú Sembrado:** Rutas `/api/v1/tenants/{tenantId}/catalog/product-templates` protegidas por permisos RBAC canónicos (`catalog.item.read`, `catalog.item.create`), e ítem de menú `catalog-templates` ("Plantillas", ícono `layers`) en `MenuCatalogSeedData.cs`.
    * **Directorio de Plantillas (`/catalogo/plantillas`):** Vista de gestión con layout M3 SaaS, tarjetas KPI en `.ecu-stat-grid` (Total Plantillas, Activas, Máximo de Niveles), filtros por estado/búsqueda y `DataGrid` de Glubox con renderizado de badges para cada nivel, colores y fotografías.
    * **Constructor Visual Dedicado (`/catalogo/plantillas/nueva` y `.../:id`):** Vista completa (siguiendo Rule 9) con `HierarchyTemplateTreeBuilder` para componer niveles jerárquicos modulares:
      - Nivel 1 (Colección / Familia): atributos macro (ej. Material, Composición).
      - Nivel 2 (Modelo / Estilo): fotos o acabados intermedios.
      - Nivel 3 (Variantes Físicas): tallas, colores con `ColorPicker` de Glubox y fotos por SKU.
      - Soporta productos simples (2 niveles, ej. tazas con color y foto en Nivel 2) y colecciones complejas. Conectado al Diccionario Maestro de Atributos (`listVariantDimensionTemplates`).
      - Vista previa interactiva en tiempo real de la jerarquía resultante.
    * **Carga en 1 Clic en Alta de Ítems (`CreateCatalogItemPage.tsx`):** Selector superior para precargar la estructura de cualquier plantilla activa, activando variantes y autocompletando atributos técnicos automáticamente.
    * **Suite de Pruebas UI:** Nueva prueba Playwright en `plantillas-producto-ui.spec.ts`.
    * **Auditoría de Residuos (Regla 10):** Limpieza proactiva de variables no usadas y cero código huérfano.
  - **Refinamiento de Atributos, Corrección de Íconos SVG e Inmutabilidad Dinámica Condicional (`CatalogAttributesListPage.tsx`, `VariantDimensionTemplate.cs`, `CatalogItemRepository.cs`):**
    * **Unificación de Nombre a "Atributos":** Nombre de página simplificado a *Atributos* en cabecera, navegación lateral (`MenuCatalogSeedData.cs`), breadcrumbs y subtítulo corporativo.
    * **Corrección de Glifos en Tarjetas KPI (`StatCard`):** Sustitución de identificadores de texto de fuentes que provocaban ligaduras rotas (`#S`, `RKLE`) por componentes nativos vectoriales SVG de Lucide (`SlidersHorizontal`, `Lock`, `Tag`, `Sparkles`).
    * **Inmutabilidad Condicional a Registros Asociados:** Los atributos del sistema y de empresa son 100% editables y eliminables siempre que no tengan productos vinculados en el catálogo. Si un atributo tiene ítems asociados, se protege automáticamente contra eliminación y renombramiento (`isInUse = true`) con candado e indicación clara para el usuario, manteniendo la integridad referencial.
  - **Optimización de Consultas y Alto Rendimiento en PostgreSQL (`CatalogItemConfiguration.cs`, `CatalogItemRepository.cs`, Migración `AddCatalogJsonbAndVariantIndexes`):**
    * **Índices Invertidos GIN en `jsonb`:** Agregados índices GIN nativos (`ix_items_custom_attributes_json` e `ix_items_variant_dimensions_json`) para búsquedas en tiempo logarítmico $O(\log N)$ con operadores de contención `@>` sobre atributos dinámicos y dimensiones de variantes.
    * **Índice Compuesto B-Tree Multi-Tenant:** Creado índice `ix_items_tenant_id_parent_id` con filtro `"deleted_at" IS NULL` para resolución instantánea tanto de productos raíz (`parent_id IS NULL`) como de variantes asociadas a un producto matriz (`parent_id = @id`).
    * **Verificación de SKU en BD:** Optimizado `SkuExistsIgnoreCaseAsync` en `CatalogItemRepository.cs` para utilizar `EF.Functions.ILike(i.Sku, trimmed)` y `AnyAsync()`, delegando la búsqueda a PostgreSQL y erradicando la carga completa de SKUs en la memoria de .NET.
    * **Pruebas y Verificación:** 381/381 tests unitarios superados en `dotnet test` y migración EF Core generada limpiamente.
  - **Diccionario Maestro de Atributos y Escalas Reutilizables (`CatalogAttributesListPage.tsx`, `ItemCustomAttributesEditor.tsx`, `MenuCatalogSeedData.cs`):**
    * **Vista Dedicada en Menú (`/catalogo/atributos`):** Nueva página bajo el módulo de Catálogo (con ícono `tags`) para consultar y gestionar el diccionario corporativo de atributos, escalas y dimensiones. Incluye `PageHeader`, KPIs `StatCard` en `.ecu-stat-grid` (Total de atributos, Escalas de sistema, Personalizadas, Valores normalizados), buscador y filtros por tipo, y `DataGrid` de glubox con chips visuales de valores y protección de inmutabilidad en escalas base del sistema.
    * **Modal de Gestión de Atributos:** Permite a la empresa registrar nuevos atributos normalizados (ej. *Tipo de Caña*, *Material*, *Grosor*) con sus opciones predefinidas organizadas por chips removibles.
    * **Autocompletado Inteligente en Creación y Edición de Ítems:** `ItemCustomAttributesEditor` se conecta en tiempo real al diccionario maestro. El nombre del atributo cuenta con `<datalist>` autocompletable y, al seleccionar un atributo (ej. *Caña*, *Manga*, *Color*), despliega automáticamente botones/pills con los valores estandarizados para seleccionarlos con un solo clic, erradicando variaciones tipográficas o errores de escritura.
    * **Registro en Navegación y Permisos:** Entrada de navegación `catalog-attributes` en `MenuCatalogSeedData.cs` vinculada al permiso canónico `catalog.scale.manage`.
    * **Calidad y Pruebas:** Compilación limpia de producción en `ecunexo_admin` (1.97s, 0 errores) y 381/381 tests unitarios superados en `ecunexo_api`.
  - **Desacoplamiento de Categorías y Atributos Adicionales Directos en el Ítem (`ItemCustomAttributesEditor.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemPage.tsx`, `CatalogItem.cs`):**
    * **Categoría como Puro Identificador Taxonómico:** La categoría ahora cumple estrictamente su función de clasificación, organización, reportes y navegación, sin imponer esquemas rígidos ni bloquear la creación de ítems o variantes.
    * **Atributos y Especificaciones Propias del Ítem:** Nuevo componente `ItemCustomAttributesEditor` de glubox/M3 integrado tanto en la creación como en la edición de productos. Permite agregar pares dinámicos `Nombre del Atributo` (ej. *Material*, *Marca*, *Garantía*, *Procedencia*) y `Valor` (ej. *100% Algodón*, *Nike*, *1 Año*), con eliminación ágil, sugerencias rápidas en 1 clic y serialización transparente a `CustomAttributesJson`.
    * **Desbloqueo de Invariantes en Backend:** Retirada de la validación bloqueante de esquema de categoría en `CatalogItem.CreatePhysical`, `CreateService`, `CreateMatrixParent`, `CreateVariantChild` y `UpdateDetails`. Cualquier ítem o variante puede registrar sus propios atributos técnicos sin colisionar con esquemas de categoría preexistentes.
    * **Soporte de Atributos Generales en Productos Matriz:** `CreateCatalogItemMatrixRequest`, `CreateCatalogItemMatrixCommand` y `CreateCatalogItemMatrixHandler` ahora reciben y persisten `CustomAttributesJson` en el producto padre, aplicando especificaciones transversales a toda la familia.
    * **Pruebas y Verificación:** 381/381 tests en verde en `dotnet test` y compilación limpia de frontend (`npm run build` en 1.33s).
  - **Evolución a "Variantes", ColorPicker de Glubox y Fotografías Independientes por Variante (`VariantMatrixBuilder.tsx`, `CreateCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`, `CatalogItemsGrid.tsx`):**
    * **Unificación Terminológica ("Variantes"):** Eliminación de términos técnicos/confusos como "Producto Matriz" o "Configurador de Variantes (Producto Matriz)" de la UI visible para el usuario final. Ahora el módulo se titula y etiqueta simplemente como **"Variantes"**, con casilla `¿Tiene variantes (tallas, colores, etc.)?`, botón `Guardar con Variantes`, e insignias unificadas `Variantes (N)` en grillas de escritorio, tarjetas móviles y vistas de detalle.
    * **Integración del `<ColorPicker>` de Glubox:** Cuando un atributo es de tipo Color (`dimName` o escala de color), se utiliza el componente atómico `<ColorPicker>` de Glubox con selector visual hex y paleta de muestras. Mapeo reactivo de colores a muestras circulares (`.ecu-color-swatch-dot`) visibles tanto en los pills interactivos activos como en la columna "Variación" de la tabla de variantes.
    * **Fotografía / Imagen Independiente por Variante:**
      - Cada variante física ahora dispone de su propia columna y control de imagen, reconociendo que cada variante cambia físicamente (color, modelo, acabado) aun cuando pertenezcan al mismo producto base.
      - En el constructor (`VariantMatrixBuilder`): selector de archivo con miniatura (`stagedImagePreview`) y botón para retirar foto.
      - En la creación (`CreateCatalogItemPage`): tras crear la matriz, se suben automáticamente las fotografías independientes de cada variante a `/api/v1/tenants/{tenantId}/catalog/items/{variantItemId}/images` mediante `uploadCatalogItemImage`.
      - En la edición (`EditCatalogItemVariantsSection`): columna "Foto" en el DataGrid con miniatura real (`mainImageThumbUrl`) o ícono de cámara si no tiene foto, y selector de foto en el modal `+ Añadir Variante` para subir la imagen inmediatamente tras crear la variante.
    * **Backend & Verificación:** Carga de imágenes de variantes hijas mediante `.ThenInclude(v => v.Images)` en `CatalogItemRepository.cs`, 381/381 tests backend en verde y build limpio de frontend.
  - **Detalle y Gestión de Variantes en Edición de Ítems (`EditCatalogItemPage.tsx`, `EditCatalogItemVariantsSection.tsx`, `AddCatalogItemVariantHandler.cs`):**
    * **Soporte de Producto Matriz en Edición:** Reconocimiento dinámico de `isMatrixParent` en `/catalogo/items/:id`. Insignia `Matriz · X variantes` en cabecera, banner informativo M3 y sección dedicada con DataGrid de Glubox listando todas las combinaciones registradas (chips de dimensiones/tallas, SKU físico, precio base y estado).
    * **Herramientas de Matriz:** Botón «+ Añadir Variante» con modal para incorporación rápida de nuevas variantes a la matriz activa (con autocompletado de prefijo SKU, sugerencia de dimensiones y stock inicial opcional en bodega), y botón de sincronización masiva de precios a todas las variantes hijas.
    * **Soporte de Variante Individual (Hijo):** Cuando `parentId` está presente, se despliega un banner destacado con enlace directo de retorno al producto matriz padre (`← Ver Producto Matriz: «Nombre del Padre»`) e insignia de variante física.
    * **Backend CQRS & Endpoints:** Endpoint `POST /api/v1/tenants/{tenantId}/catalog/items/{itemId}/variants` respaldado por `AddCatalogItemVariantCommand`, `AddCatalogItemVariantValidator` y `AddCatalogItemVariantHandler` con validación de matriz, SKU único e inicialización opcional de stock en bodega.
    * **Resolución de Nombre Padre:** `CatalogItemDetailResponse` ahora incluye `ParentName` resuelto dinámicamente en `GetCatalogItemHandler.cs`.
    * **Pruebas y Calidad:** 381/381 tests en backend pasando (240 Core + 141 Business, 5 nuevos tests para `AddCatalogItemVariantHandlerTests.cs`) y compilación limpia Vite/TypeScript en 1.51s.
  - **Refactor UI/UX de Producto Matriz y Sincronización Reactiva de Variantes (`VariantMatrixBuilder.tsx`, `CreateCatalogItemPage.tsx`):**
    * **Herencia Reactiva en Tiempo Real:** El prefijo SKU escrito en el producto padre (ej. `AND-001`) se propaga instantáneamente a todas las filas de variantes (`AND-001-2-4-NEGRO`), al igual que el precio base (ej. `$1.50`), sin requerir clics en botones de regeneración manual a menos que el usuario haya editado una celda específica (`isManualSku`, `isManualPrice`).
    * **Eliminación de Redundancias de Categoría:** Cuando `hasVariants` está activo, se filtran automáticamente los atributos dinámicos de molde coincidentes con las variantes (`talla`, `color`, `size`), evitando pedir un color o talla único obligatorio en el formulario padre.
    * **Claridad en Dimensiones:** Reemplazo de etiquetas confusas ("Escala 2", "size") por terminología natural: `Tallas / Medidas (Dimensión 1)` y `Colores / Combinación (Dimensión 2)`. Eliminación de botones duplicados de cierre y unificación del disparador a `+ Añadir Color (2da Dimensión)`.
    * **Pruebas y Verificación:** Actualización de la suite Playwright en [`producto-matriz-ui.spec.ts`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/tests-ui/comun/producto-matriz-ui.spec.ts) validando herencia de SKU y precio base. Compilación Vite/TypeScript limpia en 1.62s.
  - **Consolidación Taxonómica Oficial de Extensiones en Módulos Raíz (`catalog` y `facturacion`):**
    * Las extensiones funcionales quedan completamente integradas bajo sus módulos raíz canónicos sin fragmentación en submódulos satélite.
    * **Extensión de Catálogo (`catalog`):**
      - Capacidad: Producto Matriz, Escalas Reutilizables y Variantes Multidimensionales (Tallas/Colores).
      - Dependencias: Depende únicamente de `identity`.
      - Permisos RBAC (`catalog.*`): `catalog.matrix.read`, `catalog.matrix.create`, `catalog.matrix.update`, `catalog.matrix.delete`, `catalog.scale.manage`.
      - Límites por Tier en `ModuleTierCatalog`: `max_active_variants` (Small=100, Medium=1.000, Big=10.000, Enterprise=Ilimitado).
    * **Extensión de Facturación Electrónica SRI (`facturacion`):**
      - Capacidad: Comprobantes SRI (Notas de Crédito 04 y Guías de Remisión 06).
      - Dependencias: Requiere obligatoriamente `catalog` e `identity`.
      - Permisos RBAC (`facturacion.*`): `facturacion.notas.credito.read`, `facturacion.notas.credito.create`, `facturacion.notas.credito.anular`, `facturacion.guias.remision.read`, `facturacion.guias.remision.create`, `facturacion.guias.remision.autorizar`, `facturacion.transportistas.manage`.
      - Límites por Tier en `ModuleTierCatalog`: `max_monthly_credit_notes` (Small=20, Medium=100, Big=500, Enterprise=Ilimitado), `max_monthly_remision_guides` (Small=50, Medium=250, Big=1.000, Enterprise=Ilimitado), `max_active_carriers` (Small=5, Medium=20, Big=50, Enterprise=Ilimitado).
    * Resolución de permisos centralizada en [`PermissionModuleMapper.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Business/Tenancy/Authorization/PermissionModuleMapper.cs) al módulo raíz (`catalog` y `facturacion`).
    * Registro de permisos RBAC en [`MenuCatalogSeedData.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs) cumpliendo la regex de dominio `^[a-z0-9]+(\.[a-z0-9]+)*$`.
    * Suite de 376 pruebas backend (`EcuNexo.slnx`) pasando al 100%.
  - **Módulo de Producto Matriz (Parent-Child) & Escalas Reutilizables de Tallas/Variantes:**
    * **Arquitectura de Dominio (`CatalogItem.cs`, `VariantDimensionTemplate.cs`):**
      - Modelo auto-referencial (`ParentId` -> `Parent` con borrado en cascada) donde el producto padre (`IsMatrixParent = true`) agrupa los datos comerciales y de vitrina, mientras que cada variante física (`ParentId != null`) es un `CatalogItem` independiente con SKU único, código de barras, precio propio y stock físico en bodega.
      - Invariante físico: El producto padre nunca almacena stock directo; las existencias y movimientos de Kárdex pertenecen a las variantes físicas individuales.
      - Catálogo de plantillas reutilizables de escalas de tallas y dimensiones (`VariantDimensionTemplate`) precargado con escalas estándar para Ecuador: *Medias / Calcetines* (`35-38`, `39-41`, `42-44`), *Ropa Adulto* (`XS` a `XXL`), *Calzado Adulto* (`36` a `44`), *Pantalones/Jeans* (`28` a `38`), *Ropa Bebé/Niños* y *Colores Básicos*.
    * **Capa de Persistencia & Migraciones EF Core:**
      - Nueva tabla `catalog.variant_dimension_templates` y columnas `parent_id`, `is_matrix_parent`, `variant_dimensions_json` en `catalog.items`.
      - Migración `20260920155047_AddProductMatrixAndVariantTemplates` aplicada a PostgreSQL con `dotnet ef database update`.
      - Repositorios `IVariantDimensionTemplateRepository` y extensiones en `ICatalogItemRepository` (`ListVariantsByParentIdAsync`).
    * **Capa de Negocio CQRS (`EcuNexo.Business`):**
      - Comando transaccional atómico `CreateCatalogItemMatrixCommand`: valida unicidad de SKUs en el payload y contra la BD, crea el padre y todas las variantes en una sola transacción e inicializa el stock en bodega si se especifica.
      - CRUD completo de plantillas: `ListVariantDimensionTemplatesQuery`, `CreateVariantDimensionTemplateCommand`, `UpdateVariantDimensionTemplateCommand` y `DeleteVariantDimensionTemplateCommand` con protección estricta contra modificación o borrado de plantillas base del sistema (`IsSystemDefault`).
      - Filtro `onlyRoots` en `ListCatalogItemsQuery` para evitar saturar el catálogo principal con filas hijas.
    * **Frontend UI/UX con Material Design 3 & Glubox (`ecunexo_admin`):**
      - Componente [`VariantMatrixBuilder.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/VariantMatrixBuilder.tsx) y estilos [`variantMatrixBuilder.css`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/variantMatrixBuilder.css) con selector de escalas, chips/pills interactivos activables/desactivables con un clic, agregación al vuelo de valores personalizados, soporte opcional para 2da dimensión (ej. Color) generando el producto cartesiano de variantes, botones de copia masiva de precio y regeneración de SKUs.
      - Gestión directa de plantillas desde la interfaz: botones de «Guardar cambios» y «Eliminar» en escalas personalizadas, con indicadores visuales `Molde del sistema (base)` vs `Plantilla personalizada (editable)`.
      - Integración en [`CreateCatalogItemPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/CreateCatalogItemPage.tsx) con casilla «¿Tiene tallas o colores?» y subida automática de fotografías al ítem padre.
      - Visualización destacada en [`CatalogItemsGrid.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/CatalogItemsGrid.tsx) con insignia `Matriz · X variantes` e icono de capas tanto en tabla de escritorio como en tarjetas móviles.
    * **Nueva Skill Oficial EcuNexo (`producto-matriz-tallas-variantes`):**
      - Creación de `.agents/skills/producto-matriz-tallas-variantes/SKILL.md` documentando la arquitectura auto-referencial, invariantes físicos de stock, escalas estándar para Ecuador (calcetería, confección, calzado, pantalones, niños), producto cartesiano y flujos cruzados con Facturación SRI, Kárdex y Ecommerce.
    * **Verificación y Pruebas:**
      - 372/372 pruebas unitarias backend pasadas en verde (238 en `EcuNexo.Core.UnitTests` + 134 en `EcuNexo.Business.UnitTests` incluyendo `VariantDimensionTemplateHandlerTests`).
      - Suite de pruebas de interfaz Playwright en [`producto-matriz-ui.spec.ts`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/tests-ui/comun/producto-matriz-ui.spec.ts).
      - Compilación limpia de producción Vite/TypeScript (`tsc -b && vite build` con 0 errores).
  - **Optimización de Tarjetas para Dispositivos Móviles y Tablets en DataGrid de Catálogo (`CatalogItemsGrid.tsx`, `catalogGrid.css`):**
    * **Implementación de `renderCard` Personalizado en Glubox DataGrid:** Sustitución de la lista plana por defecto de pares clave-valor por una tarjeta de producto moderna, compacta y elegante estilo E-commerce / SaaS Enterprise.
    * **Jerarquía Visual y Tipografía:**
      - **Foto de Portada / Miniatura:** Contenedor de 60×60px con bordes suaves (`border-radius: 10px`), borde sutil y fallback elegante con degradado e icono de `<Package>` cuando el ítem no tiene foto.
      - **Cabecera:** Categoría destacada en texto pequeño mayúscula (`--glb-muted`) y badge de estado con dot verde/gris (`StatusBadge`).
      - **Título del Producto:** Tipografía robusta (`0.95rem`, `font-weight: 700`, line-clamp 2) con alto contraste para legibilidad en luz solar.
      - **Etiquetas y Metadatos:** SKU en píldora monospace (`code.ecu-code`) y tipo de ítem (`Físico` / `Servicio`).
      - **Barra de Precio Prominente:** Etiqueta "PRECIO BASE" con cifra en formato moneda grande (`font-size: 1.25rem`, `font-weight: 800`, color primario `--shell-primary`).
      - **Acciones Táctiles Directas (Touch 44px):** Botón `[Editar]` con icono `Pencil` y etiqueta de texto, más botón `[Eliminar]` de peligro con `Trash2` (aislados con `e.stopPropagation()` para evitar clicks accidentales).
      - **Pie Contextual:** Fecha de alta formateada en tipografía atenuada.
    * **Interacción Táctil Global (`onCardSelect`):** Al tocar cualquier parte de la tarjeta fuera de los botones de acción, navega directamente a la vista de edición/detalle del ítem (`/catalogo/items/:id`).
    * **Actualización a `glubox@0.1.24` & Eliminación de Parches CSS Temporales:**
      - La versión `glubox@0.1.24` incorpora nativamente la corrección de scroll táctil (`.glb-datagrid--card-layout:not(.glb-datagrid--surface-sized) .glb-datagrid__viewport { overflow: visible; height: auto }`, `.glb-datagrid__scroll--cards { overscroll-behavior: auto; touch-action: pan-y }` y `touch-action: pan-y` en tarjetas e interactive cards).
      - Se removieron limpiamente los parches CSS temporales en `ecu-companies-form.css` y `catalogGrid.css`, quedando la solución estandarizada directamente desde la librería.
    * **Actualización de Skill EcuNexo (`optimizacion-mobile-responsive`):** Documentación del estándar `renderCard` y la regla de oro de desbloqueo de scroll táctil para DataGrids móviles en la skill oficial.
    * **Ajuste de Etiqueta en Menú de Usuario (`AppShellUserMenu.tsx`):**
      - Sustitución de «Acerca de EcuNexo» por «Información» para un layout más limpio, directo y compacto junto a la píldora de versión `v{APP_VERSION_INFO.version}`.
    * **Control de Salto de Línea en Cabecera de `SectionCard` (`enterpriseUi.css`, `dashboardPage.css`):**
      - Problema: En contenedores estrechos, tarjetas de 4 columnas en Dashboard o pantallas móviles/tablets, el título y la etiqueta/acción en `.ecu-section-card__action` no cabían en una sola línea, colisionando o desbordando el ancho.
      - Solución: Se configuró `flex-wrap: wrap; gap: 0.625rem 1rem;` en `.ecu-section-card__header` con `flex: 1 1 auto` en el título para permitir que la etiqueta/acción salte a una línea propia sin comprimirse. En pantallas móviles (`<= 768px`) y en la cuadrícula de analítica del Dashboard (`ecu-dashboard-charts-grid`), se aplica diseño en columna para que la etiqueta/badge se posicione siempre de forma ordenada en su propia línea inferior.
    * **Captura Directa con Cámara en Alta y Edición de Ítems (`CameraCaptureModal.tsx`, `StagedCatalogItemImages.tsx`, `CatalogItemImageGallery.tsx`):**
      - Integración de botón «Tomar Foto» junto a «Añadir Fotos»:
        1. En tablets y smartphones (dispositivos táctiles o sin contexto WebRTC seguro en LAN): Invoca un input nativo `<input type="file" accept="image/*" capture="environment" />` que abre directamente la cámara trasera/de producto con autoenfoque y resolución nativa sin fricción ni menús intermediarios.
        2. En computadoras de escritorio/laptops con contexto seguro WebRTC: Despliega el modal [`CameraCaptureModal`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/CameraCaptureModal.tsx) con visor de video en vivo, selector/giro de cámara (frontal/trasera), disparador de obturador y confirmación previa de captura.
    * **Verificación:** Compilación TypeScript y Vite 100% limpia (`npm run build` con 0 errores).
  - **Anexado de Imágenes en Alta de Ítem, Menú Hamburguesa Off-Canvas & Skill de Optimización Móvil:**
    * **Anexado de Imágenes en Nuevo Ítem (`CreateCatalogItemPage.tsx`, `StagedCatalogItemImages.tsx`):**
      - Soporte para previsualizar, reordenar y marcar imagen de "Portada" directamente al crear un ítem (`/catalogo/items/nuevo`).
      - Zona interactiva Drag & Drop y botón de selección nativo (compatible con cámara y galería en dispositivos táctiles).
      - Pipeline asíncrono en `onSubmit`: crea el ítem en PostgreSQL y sube secuencialmente cada fotografía con optimización WebP automática a través de `uploadCatalogItemImage`.
      - Soporte de Alt Text para SEO en Google Imágenes y revocación segura de Object URLs para evitar fugas de memoria.
    * **Sidebar Adaptable con Menú Hamburguesa para Tablets y Móviles (`DashboardLayout.tsx`, `appShell.css`):**
      - En viewports `<= 1024px` (tablets y smartphones), el sidebar ya no ocupa espacio directamente: se oculta off-canvas (`transform: translateX(-100%)`).
      - Botón hamburguesa en cabecera (`.app-shell__hamburger-btn`) que alterna el menú lateral como un drawer fluido con sombra M3 y backdrop táctil (`.app-shell__mobile-backdrop`) con desenfoque de fondo (`backdrop-filter: blur(3px)`).
      - El drawer se cierra automáticamente al cambiar de ruta, al presionar `Escape` o al pulsar fuera en el backdrop.
      - Al abrirse en tablet/móvil, el sidebar se renderiza siempre expandido (`collapsed={false}`) para máxima legibilidad táctil de los nombres de módulos.
      - Eliminación del botón redundante «Cambiar de Empresa» en el `PageHeader` del dashboard de empresa activa (`DashboardPage.tsx`).
    * **Nueva Skill Oficial EcuNexo (`optimizacion-mobile-responsive`):**
      - Creación de `.agents/skills/optimizacion-mobile-responsive/SKILL.md` estableciendo la guía arquitectónica para agregar opciones en móviles (menú hamburguesa, `EcuPageActions`, touch targets mínimos de 44px, grids fluidas, inputs táctiles y DataGrids adaptables).
    * **Configuración de Red Local WiFi/LAN y Enrutamiento Proxy API (`vite.config.ts`, `apiClient.ts`, `billingApi.ts`):**
      - Habilitación de `host: true` en `server` y `preview` para enlazar a `0.0.0.0` (red local en `http://192.168.18.15:5173/`).
      - Resolución dinámica de `baseURL` en `apiClient.ts` y `billingApi.ts`: cuando el usuario accede desde un celular o tablet en la red local (`hostname !== 'localhost'`), conmuta a ruta relativa `''` en lugar de `localhost:5088` (el cual apuntaría erróneamente al propio dispositivo móvil).
      - Configuración de proxies en `vite.config.ts` para `/api` (Kestrel en `:5088`) y `/api/v1/emitters`, `/api/v1/ride-provider` (Billing en `:5203`), canalizando la autenticación y base de datos sin bloqueos de CORS.
    * **Testing Automatizado UI (`enterprise-shell-ui.spec.ts`, `catalogo-ui.spec.ts`):**
      - Pruebas Playwright para el botón hamburguesa y drawer en viewport tablet/móvil y para la nueva sección de fotos en el formulario de alta de ítems.
      - Verificación de compilación limpia con `npm run build` (0 errores).
  - **Módulo Frontend & Alineación Microservicio de Notas de Crédito Electrónicas SRI (Tipo 04) — Cobertura 100%:**
    * **Vista de Listado M3 (`CreditNotesListPage.tsx`):** Implementación de `/facturacion/notas-credito` con `PageHeader` ("Notas de Crédito SRI", insignia `SRI 04`), 4 `StatCard` en `.ecu-stat-grid` (Total Registradas, Autorizadas SRI, Borradores, Monto Modificado Acumulado), barra de herramientas con `OptionGroup` (Todas, Autorizadas, Borradores) y `GridDateRangeBox`, grilla `DataGrid` de Glubox con acciones de descarga de RIDE PDF, XML y reenvío al SRI.
    * **Vista Dedicada de Emisión (`CreditNoteCreatePage.tsx`):** Formulario completo en `/facturacion/notas-credito/nueva` (Regla 9 sin modales) para devoluciones totales y **devoluciones parciales de ítems/cantidades** o **ajustes de precio**. Incluye selector de factura autorizada de sustento (`01`), detalle de motivo SRI (1 a 300 caracteres), tabla de cantidades a devolver con cálculo reactivo de subtotal e IVA, y pipeline de firma y autorización en línea.
    * **Pruebas de Interfaz Playwright (`notas-credito-ui.spec.ts`):** Suite de pruebas UI en `tests-ui/comun/notas-credito-ui.spec.ts` verificando el renderizado de la grilla M3, StatCards y navegación a la vista dedicada.
    * **Verificación Completa:** 224/224 pruebas en microservicio `Facturacion` pasadas en verde, 350/350 pruebas en `ecunexo_api` pasadas en verde y compilación frontend `npm run build` en verde con 0 errores TypeScript.
  - **Dominio Core de Notas de Crédito Electrónicas SRI (Tipo 04) & Suite de Pruebas (`EcuNexo.Core`):**
    * **Entidades y Agregado Raíz (`CreditNote.cs`, `CreditNoteItem.cs`, `CreditNoteEnums.cs`, `CreditNoteAdditionalField.cs`):** Implementación del modelo de dominio de Notas de Crédito con invariantes tributarias estrictas (máscara de documento modificado `XXX-XXX-XXXXXXXXX`, fecha de emisión posterior o igual al sustento, cálculo automático de subtotales por tarifa de IVA 15%/13%/12%/0%/Exento/No Objeto y soporte de 2 a 6 decimales en precios y cantidades v1.1.0).
    * **Generador de XML SRI v1.1.0 (`SriCreditNoteXmlGenerator.cs`):** Generación algorítmica de archivos XML oficiales `<notaCredito id="comprobante" version="1.1.0">` con etiquetas `<infoTributaria>`, `<infoNotaCredito>`, `<totalConImpuestos>`, `<detalles>` e `<infoAdicional>`.
    * **Abstracción de Repositorio (`ICreditNoteRepository.cs`):** Contrato para persistencia, consulta por secuencial/clave de acceso y asignación atómica de contadores por ambiente.
    * **Pruebas Unitarias (226/226 tests en verde):** Creación de [`CreditNoteCoreTests.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/tests/EcuNexo.Core.UnitTests/CreditNotes/CreditNoteCoreTests.cs) en `EcuNexo.Core.UnitTests` verificando invariantes del modelo, recálculo de subtotales por tarifa de IVA, clave de acceso de 49 dígitos Módulo 11 para tipo `04` y validación de la salida XML.
  - **Creación de Skill Oficial SRI para Notas de Crédito Electrónicas (`nota-credito-sri-ecuador`):**
    * Extracción completa de especificaciones normativas de la Ficha Técnica SRI v2.32 (Esquema Offline v1.0.0 y v1.1.0 Anexo 3).
    * Definición de reglas tributarias de oro: herencia obligatoria de tarifa de IVA según la fecha de emisión del comprobante sustento (`fechaEmisionDocSustento`), restricción del `valorModificacion` al saldo de la factura, validación de la máscara `numDocModificado` (`XXX-XXX-XXXXXXXXX`), clave de acceso Módulo 11 (49 dígitos) y precisión decimal (2 a 6 decimales).
    * Integración de lógica de negocio en EcuNexo: reversión de stock en Kárdex con recálculo de Costo Promedio Ponderado para devoluciones de mercadería, ajuste de Cuentas por Cobrar (A/R), asientos contables automáticos NIIF y matriz de mitigación de errores SRI (35, 43, 45, 50, 70).
  - **Módulo de Analítica de Gestión, Grillas Compactas de 4 Indicadores y Rutas de Atajos [v0.30.0]:**
    * **Endpoint REST & Handler CQRS Real PostgreSQL (`DashboardEndpoints.cs`, `GetDashboardAnalyticsHandler.cs`):** Cómputo dinámico desde la BD para 9 indicadores (Ventas Mensuales, Comprobantes SRI, Clientes por Categoría, Compras vs Gastos, Stock por Bodega, Guías de Remisión, Taller N1/N2, Balances NIIF y Declaraciones SRI F104), con inyección obligatoria de todos los repositorios para eliminar datos estáticos/mock.
    * **Vista Analítica de Alta Densidad M3 (4 por línea) (`DashboardChartsSection.tsx`, `dashboardPage.css`):** Formateador compacto de números (`formatCompactNumber` $1k, $10k, $80k), abreviaturas legibles en ejes X/Y, alineación `margin-top: auto` pegada al bottom de las cards y grid responsive simétrico de 4 columnas en escritorios.
    * **Corrección de Enlaces de Atajos Rápidos (`DashboardPage.tsx`):** Corrección de rutas para `+ Nueva Factura` (`/facturacion/facturas/emitir`) y `Directorio Clientes` (`/clientes`), agregando el atajo `+ Nuevo Ítem` (`/catalogo/items/nuevo`).
    * **Verificación:** 317/317 pruebas unitarias backend pasadas (`dotnet test`) y compilación frontend limpia sin errores (`npm run build`).
  - **Eliminación Total de Bloqueo por RUC en Firma Electrónica (`SigningCertificate.cs`, `SriCertificateTaxIdentityValidator.cs`, `DbTenantSigningCertificateProvider.cs`, `XadesElectronicSignatureService.cs`) [v0.29.5]:**
    * **Flexibilización Criptográfica en Microservicio de Facturación:** Se eliminó la excepción de rechazo en `SigningCertificate.EnsureValidFor`, `SriCertificateTaxIdentityValidator.IsCertificateValidForRuc` y `XadesElectronicSignatureService.SignXmlAsync` que bloqueaba el timbrado XAdES-BES cuando el certificado digital pertenece a un Representante Legal o Apoderado cuyo RUC/Cédula difiere del RUC de la empresa emisor.
    * **Pruebas y Compilación:** 223/223 pruebas unitarias en `Facturacion` pasadas al 100%, 316/316 pruebas en `ecunexo_api` pasadas y `npm run build` verificado con 0 errores TypeScript.
  - **Eliminación Segura de Facturas Borrador (`InvoicesController.cs`, `EfInvoiceRepository.cs`, `FacturasGrid.tsx`) [v0.29.4]:**
    * **Endpoint REST DELETE (`Billing.Api` & `Billing.Infrastructure`):** `DELETE /api/v1/emitters/{emitterId}/invoices/{invoiceId}` y método `DeleteDraftAsync` en repositorio, restringido a comprobantes en estado `Draft` (no emitidos ni firmados).
    * **Frontend UX (`FacturasGrid.tsx` & `billingApi.ts`):** Botón de papelera (`Trash2`) para filas en borrador con modal de confirmación destructiva Glubox (`<Popup>`) y refresco automático de la grilla.
    * **Verificación:** 223/223 tests en `Facturacion` en verde, 316/316 en `ecunexo_api` en verde, `npm run build` sin errores.
  - **Habilitación de Envío de Comprobantes en Borrador al SRI desde DataGrid (`FacturasGrid.tsx`, `InvoicesController.cs`, `InvoiceSriResendRules.cs`) [v0.29.3]:**
    * **Integración en Backend (`Billing.Core` & `Billing.Api`):** Incorporación de `SriDocumentState.Draft` en `InvoiceSriResendRules.IsResendableState` y delegación transparente de `RetrySri` hacia `Sign` si la factura se encuentra en estado borrador.
    * **Frontend UX (`FacturasGrid.tsx`):** Actualización dinámica de etiqueta ("Enviar al SRI") y tooltip informativo ("Enviar borrador al SRI (firmar y transmitir)") en la grilla de comprobantes para facturas en estado `Draft`.
    * **Verificación:** 223 pruebas unitarias backend en `Facturacion` pasadas, 316 pruebas en `ecunexo_api` pasadas y `npm run build` en verde con 0 errores TypeScript.
  - **Flexibilización de RUC en Carga de Certificado Digital (`UploadSigningCertificateHandler.cs`) [v0.29.2]:**
    * Se removió el bloqueo estricto que comparaba el RUC de la empresa con el RUC en los metadatos del certificado `.p12`. Esto permite habilitar firmas digitales emitidas a personas naturales o representantes cuyo RUC no coincide carácter por carácter con la empresa en la BD.
    * Pruebas unitarias backend (316/316) y build de producción Vite/TypeScript verificados sin errores. Commit y push realizados a `origin/main`.
  - **Unificación de Configuración de Correo en Preferencias del Sistema y Diagnóstico SMTP (`SettingsEndpoints.cs`, `MenuCatalogSeedData.cs`, `AppSettingsEmailSection.tsx`):**
    * **Consolidación en Vista Única:** Eliminación de la duplicidad entre "Ajustes de Empresa / Correo" (`/organizacion/correo`) y "Preferencias del Sistema" (`/app/configuracion`). Se retiraron `configuracion-correo` y `sub-correo` del catálogo de menús (`MenuCatalogSeedData.cs`), se quitó el enlace redundante del menú de usuario (`AppShellUserMenu.tsx`) y se estableció redirección automática desde `/organizacion/correo` hacia `/app/configuracion`.
    * **Diagnóstico de Clave Incorrecta en Zoho Mail (2FA / Application Password):** La clave SMTP no se encripta ni se hashea (se guarda como texto plano en la BD). El error de "clave incorrecta" en Zoho se produce porque con 2FA activo Zoho rechaza la contraseña normal y exige obligatoriamente una *Contraseña de Aplicación* (16 caracteres) generada en `accounts.zoho.com`. Se añadieron guías y validaciones en la interfaz para advertir sobre 2FA, acceso SMTP en Zoho y dominios regionales (`smtp.zoho.eu` vs `smtp.zoho.com`).
    * **Prueba Inmediata sin Guardado Previo Obligatorio:** En `SettingsEndpoints.cs`, `TestEmailSettingsAsync` ahora permite ejecutar la prueba directamente con los datos ingresados en el formulario en tiempo real, sin bloquear al usuario si aún no había guardado en base de datos.
    * **Preservación Segura de Contraseña y UX de Asteriscos:**
      - Se eliminó la inyección artificial de `'********'` en el valor del input, la cual confundía al usuario y corrompía la clave si se editaba parcialmente.
      - El input muestra placeholder `'•••••••• (Guardada en el servidor)'` y un badge verde de estado cuando existe contraseña en el servidor.
      - Se añadió botón de alternancia de visibilidad (ojo Mostrar/Ocultar) para verificar la contraseña tipeada antes de guardar o probar.
      - `UpdateEmailSettingsAsync` hereda de forma segura la contraseña del motor universal si una empresa personaliza sus datos por primera vez dejando la contraseña vacía.
  - **Fix: Prueba de Correo SMTP Falla con Credenciales Guardadas (`SettingsEndpoints.cs` + `CompanyEmailSettingsPage.tsx`):**
    * **Causa raíz:** `TestEmailSettingsAsync` llamaba `GetEffectiveConfigAsync` que descarta configs del tenant con `IsEnabled=false`, cayendo al motor global (sin credenciales) y retornando "Se requieren las credenciales SMTP" aunque la empresa tenía sus datos guardados.
    * **Fix backend (`SettingsEndpoints.cs`):** El endpoint `/settings/email/test` ahora lee **directamente** la config del tenant desde el repositorio (sin filtrar por `IsEnabled`) antes de recurrir al fallback global. Así la prueba siempre tiene acceso a las credenciales reales persistidas.
    * **Fix UI (`CompanyEmailSettingsPage.tsx`):** `ecu-companies-kpi-grid` → `ecu-stat-grid` para cumplir la Regla 2 de diseño (StatCards siempre dentro de `ecu-stat-grid`).
    * **Verificación:** Build frontend 0 errores, build .NET 0 errores/advertencias.
  - **Aislamiento y Resolución de Firma Electrónica Multi-Empresa (`DbTenantSigningCertificateProvider` & `InvoicesController`):**
    * **Desbloqueo de Validación en Memoria (`InvoicesController.cs`):** Eliminación del bloqueo prematuro `EmitterSigningValidator.EnsureReadyToSign(emitter)` que lanzaba `emitter.signing_certificate_missing_or_invalid` cuando la empresa no tenía certificado en columnas legacy de `billing.emitters`. Ahora delega de manera transparente la resolución y verificación al proveedor desacoplado `signatureService.SignXmlAsync`.
    * **Resolución Multi-Tenant de Firma por TenantId y Cédula/RUC (`DbTenantSigningCertificateProvider.cs`):** En la consulta SQL de `tenancy.tenant_signing_certificates`, se prioriza por `tenant_id` (`ORDER BY CASE WHEN tenant_id = @tenantId THEN 0 ELSE 1 END`) y se añade compatibilidad para personas naturales cuya cédula (10 dígitos en Security Data u otras ACs) coincide con los primeros 10 dígitos del RUC emisor (13 dígitos, ej. `0926398074` <-> `0926398074001`).
    * **Propagación de `X-Tenant-Id` en Firma de Facturas:** `billingApi.ts` y `invoiceEmitApi.ts` transmiten el header `X-Tenant-Id` en `POST /invoices/{id}/sign`, permitiendo asociar de forma transparente el tenant al emisor en `InvoicesController` y aislar las firmas de cada empresa (`everchic` vs `ecunexo`).
    * **Mensajería de Error Humana en Frontend (`readApiError.ts`):** `readApiError` ahora prioriza `data.message` sobre códigos crudos como `emitter.signing_certificate_missing_or_invalid`, desplegando al usuario la razón exacta en español.
  - **Motor de Correos Jerárquico por Empresa con Fallback Universal de Plataforma EcuNexo (v0.27.2):**
    * **Aislamiento Multi-Tenant Estricto de Correo:** Cada empresa cliente puede configurar su propio motor SMTP (Zoho Mail, Google Workspace, Outlook, etc.) de manera 100% aislada. La configuración se almacena en `platform.sys_settings` con `Scope = SettingScope.Tenant` y `ScopeId = tenantId`, impidiendo que ninguna empresa modifique o acceda a las credenciales de otras.
    * **Fallback Universal EcuNexo:** Si una empresa no define un motor propio, el despachador de correos (`SmtpEmailSender`) recurre automáticamente a la configuración universal de la plataforma (`SettingScope.Global`) y, en su defecto, a las variables de entorno `Smtp:*`.
    * **Endpoints REST Jerárquicos (`SettingsEndpoints.cs`):**
      - `GET /api/v1/settings/email`: Devuelve la configuración efectiva de la empresa activa, indicando si es propia (`IsCustom = true, Scope = "Tenant"`) o si usa el motor universal (`IsCustom = false, Scope = "Global"`).
      - `PUT /api/v1/settings/email`: Persiste la configuración con alcance `Tenant` si el usuario tiene empresa activa en sesión, o `Global` si es titular de plataforma.
      - `DELETE /api/v1/settings/email`: Elimina el override de la empresa activa, revirtiendo instantáneamente al motor universal de EcuNexo.
      - `POST /api/v1/settings/email/test`: Realiza prueba de conexión y envío SMTP en tiempo real utilizando las credenciales activas de la empresa.
    * **UI/UX con glubox y Feedback Contextual (`AppSettingsEmailSection.tsx` & `CompanyEmailSettingsPage.tsx`):**
      - Banners informativos claros que distinguen entre "Motor de Correo Propio de esta Empresa" y "Motor Universal EcuNexo (Por Defecto)".
      - Botón de acción rápida "Restaurar motor EcuNexo" para volver al motor centralizado con un solo clic.
      - Acceso directo desde `/organizacion/correo` y barra de configuración del sistema.
    * **Calidad y Verificación:** 316 pruebas unitarias .NET superadas (Core y Business) y build frontend limpio (0 errores).
  - **Auto-Aprovisionamiento de Clientes en Directorio, Selector de Tipo de Cliente y Validaciones Mínimas SRI en Core Facturación:**
    * **Validaciones Mínimas de Factura y Contraparte en Core (`Billing.Core`):**
      - `Counterparty.cs`: Validación estricta de tipo de identificación SRI (`04`: RUC 13 dígitos, `05`: Cédula 10 dígitos, `06`: Pasaporte, `07`: Consumidor Final `9999999999999`, `08`: Exterior). Validación de longitud de razón social (2 a 300 caracteres), dirección máxima 300 caracteres y formato de email.
      - `ElectronicInvoice.cs`: Invariantes de fecha de emisión válida (no default), contraparte obligatoria, mínimo 1 ítem/línea, verificación de totales y regla SRI de límite máximo de USD 50.00 para facturas a Consumidor Final (`07`).
      - Tests unitarios en `Billing.Core.Tests`: 169/169 tests pasando al 100% incluyendo casos positivos y negativos de RUC/Cédula, tipos inválidos y límite de $50 en Consumidor Final.
    * **Backend de Clientes (`ecunexo_api`):**
      - Repositorio `ICustomerRepository` y `CustomerRepository`: Método `GetByTaxIdAsync(tenantId, taxId, ct)` para búsqueda rápida de contrapartes.
      - Endpoint `GET /api/v1/tenants/{tenantId}/customers/by-tax-id/{taxId}` habilitado con permisos de lectura y facturación (`facturacion.facturas.create`).
      - Endpoint `POST /api/v1/tenants/{tenantId}/customers`: Parámetro `ReturnExistingIfExists = true` para aprovisionamiento idempotente seguro (evita 409 Conflict si fue registrado concurrentemente).
      - Filtro de permisos extendido: usuarios con permiso `facturacion.facturas.create` pueden crear clientes en el directorio automáticamente al emitir facturas sin necesidad de rol administrativo de gestión de clientes.
    * **Frontend Facturación (`ecunexo_admin`):**
      - Campo y selector reactivo de **Tipo de Cliente** (`customerType`: Corporativo B2B, Persona Natural, Distribuidor Mayorista, Taller Aliado, Consumidor Final, Institución Pública) en la cabecera de emisión de facturas (`InvoiceClientFields.tsx`).
      - Asignación inteligente por defecto al cambiar tipo de identificación SRI (`04`/`08` -> Corporativo B2B, `05`/`06` -> Persona Natural, `07` -> Consumidor Final).
      - Flujo de emisión en `useInvoiceEmitForm.ts`: Al enviar la factura, si no es Consumidor Final, se auto-aprovisiona o verifica en el Directorio de Clientes (`getOrCreateCustomer`) antes de guardar el borrador, garantizando que todo cliente facturado quede registrado en el directorio con su tipo de cliente seleccionado.
      - Rebalanceo visual en cuadrícula simétrica de 4x2 campos en pantallas de alta resolución.
      - Cobertura de tests Playwright en `tests-ui/comun/facturacion-cliente-tipo.spec.ts` pasando al 100%.
  - **Motor de Correos Electrónicos Transaccionales (Zoho Mail / SMTP) y Configuración Multi-Empresa Centralizada en BD:**
    * **Motor de Envío SMTP con MailKit (`SmtpEmailSender` & `IEmailSender`):**
      - Implementación completa de `SmtpEmailSender` sustituyendo el stub `LoggingEmailSender`, con soporte nativo de sockets seguros SSL (puerto 465) y STARTTLS (puerto 587) requeridos por Zoho Mail.
      - Recuperación dinámica de parámetros desde la base de datos PostgreSQL (`platform.sys_settings`, código `system.email.smtp`, scope `Global`), permitiendo que cualquier cambio en caliente desde la interfaz surta efecto inmediato sin reiniciar servicios.
      - Respaldo de variables de entorno (`Smtp:Host`, `Smtp:Port`, `Smtp:UserName`, etc.) para casos de configuración estática o inicialización.
      - Enriquecimiento de `EmailMessage` con campo opcional `HtmlBody` preservando compatibilidad regresiva completa.
    * **Endpoints REST de Configuración y Diagnóstico en `SettingsEndpoints.cs`:**
      - `GET /api/v1/settings/email`: Devuelve los parámetros SMTP activos con máscara de seguridad en la contraseña (`HasPassword = true`).
      - `PUT /api/v1/settings/email`: Persiste la configuración en `platform.sys_settings` preservando la contraseña existente si el usuario no la modifica.
      - `POST /api/v1/settings/email/test`: Ejecuta handshake SMTP en tiempo real y envía un correo de verificación con plantilla HTML/texto al destinatario especificado, reportando diagnósticos claros ante credenciales inválidas o fallos de red.
    * **Variables de Entorno para Base de Datos en Portainer / Docker:**
      - Actualización de `docker-compose.yml` y `.env.example` con variables granulares (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`) y soporte de cadena de conexión directa `DATABASE_CONNECTION_STRING`.
    * **Apartado Frontend en Preferencias del Sistema (`AppSettingsEmailSection.tsx`):**
      - Integración de sección empresarial en [`AppSettingsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/settings/AppSettingsPage.tsx) (`/app/configuracion`).
      - Botón de preajuste inteligente «Preajuste Zoho Mail» (`smtp.zoho.com`, puerto 465 SSL, remitente predeterminado).
      - Controles de UI con `glubox` (`TextBox`, `CheckButton`, `Button`, `Toast`), badges de estado y panel integrado para prueba de envío en tiempo real.
    * **Calidad y Tests Automatizados:**
      - Tests unitarios en [`EmailSmtpConfigTests.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/tests/EcuNexo.Core.UnitTests/Platform/EmailSmtpConfigTests.cs) verificando invariantes y serialización JSON.
      - 316 tests unitarios pasando al 100% (211 Core + 105 Business).
      - Build de producción Vite/TypeScript verificado con 0 errores.
  - **Ampliación y Unificación del Layout Base para Monitores de 32" y Alta Resolución (`--ecu-layout-max-width: 1720px`):**
    * **Unificación de Medida Global:** Sustitución del límite rígido de `1400px` por la variable CSS `--ecu-layout-max-width: 1720px` con `max-width: min(100%, var(--ecu-layout-max-width, 1720px))` en `.ecu-dashboard-layout` y `.ecu-dashboard-layout--fluid` dentro de `enterpriseUi.css` y `dashboardPage.css`.
    * **Aprovechamiento de Grillas (DataGrid) y Secciones:** Incremento de +320px (+23%) en el ancho horizontal disponible para tablas y vistas (Compras, Facturación, Inventarios, Kardex, Clientes, Guías de Remisión), eliminando el espacio muerto en monitores 2K/4K de 32 pulgadas y manteniendo adaptabilidad fluida (100% de ancho) en pantallas 1080p sin scroll horizontal.
    * **Build verificado:** Compilación TypeScript y Vite exitosa con 0 errores.
  - **Aislamiento Total de Contadores SRI (Producción vs Pruebas), Garantía Estricta de Clave/XML y Diagnóstico Técnico en el SPA:**
    * **Aislamiento de Contadores en Base de Datos (`billing.emission_point_configs`):**
      - Separación estricta de contadores en PostgreSQL: columna `LastSequential` (Producción, Ambiente 2) y columna `LastTestSequential` (Pruebas, Ambiente 1).
      - Las emisiones en entorno de pruebas jamás incrementan, alteran ni consumen el secuencial real de producción del cliente (`everchic`).
      - Actualización del índice único en `billing.electronic_invoices` a `(EmitterId, Environment, Establishment, EmissionPoint, DocumentType, Sequential)` para permitir coexistencia sin colisiones entre ambientes.
      - Métodos `AllocateNextSequentialAsync`, `PeekNextSequentialAsync` y `SetNextSequentialAsync` en `EfEmitterRepository` ramifican según el ambiente activo.
    * **Garantía Estricta de Clave de Acceso (49 dígitos) y XML Firmado:**
      - Posición 24 (índice 23) de la clave de acceso estrictamente `'2'` para Producción y `'1'` para Pruebas.
      - Nodo `<ambiente>2</ambiente>` en XML de producción y `<ambiente>1</ambiente>` en pruebas.
      - Servicios `Sign` y `PreviewXml` regeneran automáticamente clave y nodo XML si el comprobante fue generado previamente con un ambiente distinto al solicitado.
    * **Diagnóstico Técnico y Trazabilidad en el SPA (`ecunexo_admin`):**
      - `SriEmitTrace`: captura y preserva datos completos de la emisión (timestamp, modo, ambiente, RUC emisor, serie, secuencial solicitado, payload JSON enviado, factura creada, XML generado, resultado de firma, estado terminal SRI y mensaje de error crudo).
      - Salida en consola enriquecida con `console.group` (`🚀 [EcuNexo SRI Emisión] Factura -> Producción/Pruebas`) mostrando el objeto exacto enviado y devuelto en cada etapa del pipeline.
      - Modal interactivo de diagnóstico [`InvoiceEmitTraceModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/InvoiceEmitTraceModal.tsx) accesible desde la cabecera («Diagnóstico SRI») o ante respuestas DEVUELTA del SRI (error [35] u otros).
      - Visualizador interactivo de los 49 dígitos de la clave con desglose en chips (Fecha, Doc, RUC, Ambiente P24 resaltado, Serie, Secuencial resaltado, Código, Emisión, DV), botones para copiar clave, copiar XML y copiar payload JSON.
      - Sincronización del ambiente en `ContabilidadSriConfigPage.tsx` y `useInvoiceEmitForm.ts` para que `peekNextSequential` y `setNextSequential` operen sobre el contador correcto según el perfil de emisión activo.
    * **Tests Automatizados:**
      - 190 tests unitarios backend pasando al 100% en `Facturacion` (152 Core, 9 Business, 29 Infrastructure).
      - Tests Playwright de desglose de clave de acceso y diagnóstico en `tests-ui/comun/facturacion-trace-diagnostico.spec.ts` pasando al 100%.
      - Build de producción Vite/TypeScript en `ecunexo_admin` verificado con 0 errores.
  - **Preservación Estricta de Identidad Emisor, Corrección Estructura XML SRI (Error 35) y Secuencial Dinámico Centralizado:**
    * **Blindaje de Identidad Emisor (`SriEmissionIdentityResolver` & `SriOptions`):**
      - Desactivación de la sustitución automática de identidad de prueba (`Enabled: false` por defecto).
      - Eliminación del secuestro de RUC (`0926398074001`), Razón Social (`ecunexo`), establecimiento (`002`) y punto (`025`), preservando siempre los datos reales del tenant (`everchic` / `0993397804001`) tanto en Producción como en Pruebas.
      - Al no sustituir la identidad, el emisor propietario en `CreateInvoiceService` se mantiene en el tenant real, evitando que los secuenciales se asignen a emisores demo o se reinicien inesperadamente.
    * **Estructura Oficial XML SRI Ficha Técnica v2.32 (Resolución de Error [35] DEVUELTA):**
      - Incorporación de `<dirEstablecimiento>` inmediatamente posterior a `<fechaEmision>` en `<infoFactura>` y `<infoNotaCredito>`.
      - Incorporación de `<obligadoContabilidad>` dinámico según ficha tributaria de la empresa.
      - Formateo de precios unitarios con mínimo 2 decimales y hasta 6 (`0.00####`), evitando valores sin formato de moneda (`"50"`).
      - Enriquecimiento de `InvoiceXmlEmitterContext` y `RideProviderResolver.ToXmlContext` para resolver y mapear la dirección del establecimiento emisor desde `emitter.Establishments`.
    * **Secuencial Dinámico y Ajustes de Empresa (`EfEmitterRepository`):**
      - Eliminación de la restricción de rebobinado en `SetNextSequentialAsync` (`requested < currentNext`), permitiendo al administrador configurar y corregir libremente el punto de partida (ej. `534`) en Ajustes de Empresa.
      - Cálculo automático del siguiente secuencial (`LastSequential + 1`) tras cada emisión y sincronización reactiva inmediata con la vista del formulario.
    * **Tests Unitarios & Build:**
      - 100% de tests unitarios pasando en `Facturacion` (151 Core + 7 Business + 29 Infrastructure).
      - Compilación de `Billing.Api` y build de `ecunexo_admin` verificados con 0 errores.
  - **Control Estricto de Ambiente SRI (Producción vs Pruebas) y RIDE PDF Sin Marcas de Prueba (`v0.25.2`):**
    * **Backend (`Facturacion` / `Billing.Api`):**
      - `BuildAccessKey`: Genera dinámicamente el dígito 24 (ambiente) de la clave de acceso de 49 dígitos según el ambiente resuelto (`'1'` para Pruebas, `'2'` para Producción).
      - `XmlEmitter`: Emite `<ambiente>2</ambiente>` en producción y `<ambiente>1</ambiente>` en pruebas.
      - `ISriEmissionIdentityResolver` / `SriEmissionIdentityResolver`: Acepta `environmentOverride` garantizando que en modo Producción no se sustituya la identidad ni el certificado del emisor por las credenciales de prueba Celcer.
      - Endpoints `Sign`, `PreviewXml`, `DownloadXml` y `RetrySri`: Toman en cuenta el query param `environment` y preservan el ambiente si la clave de acceso ya contiene `'2'` en posición 24.
      - Encolamiento Outbox: Encola operaciones con `Production` dirigiendo el worker a los endpoints reales del SRI (`cel.sri.gob.ec`) en lugar de pruebas (`celcer.sri.gob.ec`).
      - Tests unitarios: 100% pasando (151 Core + 7 Business + 29 Infrastructure).
    * **Frontend (`ecunexo_admin`):**
      - `useInvoiceEmitForm`: Toma el ambiente directamente desde la configuración de la empresa (`emitProfile.sriEnvironment`, configurado en Ajustes de Empresa → Facturación electrónica) y lo envía a `saveInvoiceDraft`.
      - `invoiceEmitApi`: Pasa `sriEnvironment` a `toCreateInvoiceBody`, `previewInvoiceXml` y `signInvoice`.
      - `billingApi`: Métodos `signInvoice`, `previewInvoiceXml` y `retryInvoiceSri` reciben y transmiten `environment`.
      - `FacturasGrid`: Detección reactiva de ambiente (`rowEnv`) por dígito 24 (`accessKey[23] === '2'`) para reenvío y anulación con nota de crédito.
      - `RideFacturaDocument`: Al recibir clave de acceso con dígito 24 `'2'`, `isTest` evalúa a `false`, mostrando `Ambiente: PRODUCCIÓN` y eliminando por completo el banner superior de pruebas y la marca de agua `PRUEBAS — SIN VALIDEZ TRIBUTARIA`.
      - Build verificado: Compilación TypeScript y Vite exitosa con 0 errores.
  - **Tipo de Gasto Predeterminado en Proveedores, Edición Interactiva en Cola de Compras y Secuencial Centralizado (`v0.25.0`):**
    * **Backend (`ecunexo_api` & `Facturacion`):**
      - Entidad `Supplier`: propiedad `DefaultExpenseTypeId`, configuración EF Core con columna `default_expense_type_id` y migración `20260914040000_AddDefaultExpenseTypeIdToSuppliers.cs`.
      - CQRS: Mapeo en `CreateSupplierCommand`, `CreateSupplierHandler`, `UpdateSupplierCommand`, `UpdateSupplierHandler`, `SupplierResponse` y contratos REST V1 (`PurchaseContracts.cs`, `SupplierEndpoints.cs`).
      - Parseo XML SRI: `ParseSriPurchaseXmlCommand` consulta si el proveedor está registrado y retorna su `DefaultExpenseTypeId` en `DetectedSupplierDto`.
      - Facturación Electrónica (`Billing.Api` / `Billing.Business`): `CreateInvoiceService` recibe y respeta `RequestedSequential` provisto por la empresa; `SriEmissionIdentityResolver.cs` preserva certificados configurados por empresa.
      - Cobertura de tests unitarios: 313/313 pasando al 100% (209 Core + 104 Business).
    * **Frontend (`ecunexo_admin`):**
      - `SupplierModal.tsx`: selector reactivo de «Tipo de Compra / Gasto Predeterminado» para compras y XMLs.
      - `SuppliersListPage.tsx`: columna visible «Gasto / Servicio Predeterminado» en DataGrid con mapeo de catálogo.
      - `ImportPurchasesPage.tsx`: asignación automática del tipo de gasto del proveedor al cargar facturas electrónicas XML; edición interactiva completa por línea (cantidad, precio unitario, descuento, tasa IVA, almacén vs servicio, bodega) y recálculo automático de subtotales e impuestos en tiempo real ([`purchaseCalculations.ts`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/utils/purchaseCalculations.ts)).
      - `CompanyLegalFields.tsx`: eliminación de establecimiento redundante en Editar Empresa, centralizándolo en Ajustes de Empresa → Facturación electrónica.
      - Tests UI en Playwright: 24/24 tests pasando al 100% en `tests-ui/comun/compras-ui.spec.ts`.
  - **Resolución Idempotente de Proveedores en Importación de XML de Compras (`v0.24.1`):**
    * **Backend (`ecunexo_api`):**
      - Endpoint REST V1 `GET /api/v1/tenants/{tenantId}/purchases/suppliers/by-tax-id/{taxId}` con handler `GetSupplierByTaxIdHandler` para consultar proveedores directamente por RUC/Cédula.
      - Opción `ReturnExistingIfExists` en `CreateSupplierCommand` y `CreateSupplierApiRequest`. Si el proveedor ya existe en la base de datos por RUC o Razón Social, retorna el proveedor existente con HTTP 200/Success en lugar de fallar con error de conflicto 409 (`purchases.supplier.tax_id_duplicate`).
      - Cobertura de tests unitarios: 312 tests pasando al 100% (208 Core + 104 Business).
    * **Frontend (`ecunexo_admin`):**
      - Funciones `getSupplierByTaxId` y `getOrCreateSupplier` en `purchasesApi.ts`. Resuelve proveedores automáticamente y captura conflictos 409 para consultar y vincular el proveedor existente sin error.
      - Caché reactivo de proveedores por TaxId (`resolvedSuppliersCache`) en `ImportPurchasesPage.tsx` durante el procesamiento por lotes: si hay múltiples facturas en la cola del mismo proveedor, la primera lo registra/resuelve y las siguientes reutilizan el ID sin intentar duplicar al proveedor ni rechazar los XMLs subsiguientes.
      - `ParseXmlModal.tsx` actualizado para usar `getOrCreateSupplier`.
      - Pruebas E2E en Playwright: 22/22 tests pasando al 100% en `tests-ui/comun/compras-ui.spec.ts`.
  - **Módulo de Guías de Remisión Electrónicas SRI (Tipo 06) — Concluido al 100% (Backend, Frontend & E2E):**
    - **Backend (`ecunexo_api`):**
      * Dominio Core (`EcuNexo.Core`): Agregado raíz `RemisionGuide`, entidad `RemisionGuideItem`, enums `RemisionGuideStatus` (Draft, Issued, Authorized, InTransit, Delivered, Cancelled).
      * Generador oficial de XML SRI `<guiaRemision version="1.1.0">` (`SriRemisionGuideXmlGenerator.cs`) con soporte para datos de transportista, placa vehicular, fechas de inicio/fin de traslado, destinatario, motivo de traslado, documento de sustento tributario y desglose de mercadería.
      * Clave de Acceso SRI de 49 dígitos con algoritmo Módulo 11 para tipo comprobante `06`.
      * Persistencia EF Core: `RemisionGuideConfiguration` y `RemisionGuideItemConfiguration` en esquema `billing` (`billing.remision_guides`, `billing.remision_guide_items`). Migración `20260914013818_AddRemisionGuidesModule`. Repositorio `IRemisionGuideRepository` / `RemisionGuideRepository`.
      * CQRS Handlers: `CreateRemisionGuideCommand` (autonumeración secuencial, generación de clave y XML), `UpdateRemisionGuideStatusCommand` (transiciones logísticas a `InTransit`, `Delivered`, `Cancelled`), `ListRemisionGuidesQuery` (filtros y cálculo reactivo de KPIs), `GetRemisionGuideByIdQuery` (detalle y descarga XML). Registro explícito en `DependencyInjection.cs`.
      * Endpoints REST V1: `GET /api/v1/tenants/{tenantId}/billing/remision-guides`, `POST`, `PATCH /{id}/status`, `GET /{id}`, `GET /{id}/xml`. Permisos RBAC conformes a regex (`facturacion.guias.remision.read`, `facturacion.guias.remision.create`) y menú con icono `truck` en `MenuCatalogSeedData.cs`.
      * Tests Unitarios Backend: 308/308 tests pasando al 100% (208 Core + 100 Business).
    - **Frontend (`ecunexo_admin`):**
      * Servicios API y tipos TypeScript estrictos en `remisionGuidesApi.ts`.
      * Vista canónica Enterprise M3 [`RemisionGuidesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/RemisionGuidesListPage.tsx) bajo `/facturacion/guias-remision` con PageHeader, 4 KPIs en `.ecu-stat-grid` (Total Registradas, Autorizadas SRI, En Tránsito, Entregadas), filtros `OptionGroup`, DataGrid Glubox, acciones logísticas y modal de inspección RIDE.
      * Vista dedicada de emisión [`RemisionGuideCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/RemisionGuideCreatePage.tsx) bajo `/facturacion/guias-remision/nueva` (Regla 9 sin modales) con 5 secciones de `SectionCard` (Emisión y Logística, Transportista, Destinatario y Ruta, Documento Sustento, Mercadería Transportada), banner de firma digital y validaciones preventivas.
      * Prevención de duplicidad de botones en `ComprobantesPage.tsx` (Regla 3).
      * Tests E2E en Playwright: 5/5 tests pasando al 100% en `tests-ui/comun/guias-remision-ui.spec.ts`.
  - **Herencia de Credenciales Root en Creación de Empresa & Planes Transporte (`v0.23.1`):**
    - **Backend (`ecunexo_api`):** `ProvisionSubscriptionCompanyHandler` permite omitir `OwnerPassword` heredando automáticamente el hash de contraseña del usuario titular root (`account.PasswordHash`). `OwnerEmail`, `OwnerName` y `OwnerPhone` heredan también por defecto los datos del titular si no son provistos. `ProvisionSubscriptionCompanyValidator` condiciona la longitud de contraseña a su presencia. Tests unitarios en `ProvisionSubscriptionCompanyHandlerTests.cs` (300 tests backend pasando al 100%).
    - **Frontend (`ecunexo_admin`):** Actualización de `CreateCompanyPage.tsx` eliminando la obligatoriedad de crear y confirmar una nueva contraseña para la empresa. Incorporación de banner informativo M3 confirmando el acceso unificado del titular con sus credenciales actuales y toggle opcional `CheckButton` para asignar contraseñas diferenciadas si el usuario lo desea.
    - **Documentación de Planes Sector Transporte:** Redacción de `18-planes-y-precios-sector-transporte-ecuador.md` con matriz comercial (Plan Local $428/año vs Plan Empresa $806/año) y auditoría de cumplimiento funcional ante el SRI.
  - **Fase 4: Estados Financieros Oficiales NIIF para PYMES y SuperCompañías Ecuador (Balance General y Estado de Resultados Integral P&G) — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Query `GetFinancialStatementsQuery` con agregación de saldos por grupos contables oficiales (Activo 1, Pasivo 2, Patrimonio 3, Ingresos 4, Costos y Gastos 5).
      * Cálculo de Estado de Situación Financiera (Balance General): Activo Corriente y No Corriente, Pasivo Corriente y No Corriente, Patrimonio Neto, verificación de ecuación contable fundamental ($\text{Activo} = \text{Pasivo} + \text{Patrimonio}$) y cálculo de diferencia de cuadre.
      * Cálculo de Estado de Resultados Integral (P&G): Ingresos operacionales ordinarios (Ventas 15% y 0%), Costo de ventas, Utilidad Bruta, Gastos operacionales (Administración y Ventas/Marketing), Utilidad Operativa (EBITDA), 15% de Participación de Trabajadores (Art. 97 Código de Trabajo Ecuador), 25% de Provisión de Impuesto a la Renta Sociedades (SRI) y Utilidad Neta del Ejercicio.
      * Integración de la Utilidad Neta en el Balance General (Patrimonio cuenta 3.5.01) cerrando el ciclo contable de partida doble.
      * Endpoint REST V1 en `GET /api/v1/tenants/{tenantId}/accounting/financial-statements` con permisos RBAC conformes a regex (`contabilidad.balances.read`).
      * Tests unitarios exhaustivos en `FinancialStatementsTests.cs`: 298 tests backend pasando al 100% (203 Core + 95 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista dedicada [`FinancialStatementsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/FinancialStatementsPage.tsx) bajo `/contabilidad/balances` con selector de Año/Mes, 4 StatCards en `.ecu-stat-grid` (Total Activos, Total Pasivos, Patrimonio Neto y Utilidad Neta), banner de verificación de la ecuación fundamental NIIF, pestañas para Balance General y P&G con formato oficial, botón de impresión / PDF.
      * Servicios API y tipos TypeScript estrictos en `financialStatementsApi.ts`.
      * Registro de ruta en `routes.tsx` y menú en `MenuCatalogSeedData.cs`.
      * Tests E2E en Playwright: 8/8 tests pasando al 100% en `tests-ui/comun/contabilidad-ui.spec.ts`.
  - **Fase 3: Motor de Pre-declaración Tributaria SRI F104 / F103 y Conciliación S.A.S. — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Query `GetMonthlyTaxDeclarationQuery` con cálculo de casilleros oficiales SRI para Formulario 104 (Ventas 401, 411, 403, 429, 499; Compras 500, 510, 507, 529, 564, 569; Liquidación 601, 609, 615 y saldo neto a pagar/favor).
      * Cálculo de casilleros de Retenciones en la Fuente F103 (Bienes 312 [1.75%], Liquidaciones de compra 343 [1%]).
      * Conciliación S.A.S. para gerencia y contadora (Ventas netas, compras netas, margen bruto operativo, flujo tributario neto acumulado y auditoría de cuadre NIIF de asientos).
      * Endpoint REST V1 en `GET /api/v1/tenants/{tenantId}/accounting/tax-declarations/monthly` con permisos RBAC (`contabilidad.declaraciones.read`).
      * Tests unitarios exhaustivos en `TaxDeclarationsTests.cs`: 296 tests backend pasando al 100% (203 Core + 93 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista dedicada [`TaxDeclarationsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/TaxDeclarationsPage.tsx) bajo `/contabilidad/declaraciones` con selector de Año/Mes, 4 StatCards en `.ecu-stat-grid` (IVA Cobrado, IVA Soportado, Retenciones F103 y Saldo Neto), pestañas interactivas para F104 (desglose oficial SRI por casilleros), F103 y Ajuste de Cuentas Integral S.A.S. con auditoría de cuadre del Libro Diario.
      * Servicios API y tipos TypeScript estrictos en `taxDeclarationsApi.ts`.
      * Ruta configurada en `routes.tsx` y build limpio con `npm run build`.
      * Pruebas E2E de Playwright: 7/7 tests pasando al 100% en `tests-ui/comun/contabilidad-ui.spec.ts`.
  - **Fase 2: Motor de Asientos Contables Automáticos NIIF / Libro Diario / Partida Doble — Concluida al 100%:**
    - **Backend (`ecunexo_api`):**
      * Dominio Core: Entidades `JournalEntry`, `JournalEntryLine`, enums `JournalEntrySource` (Manual, SalesInvoice, PurchaseInvoice, PurchaseSettlement, etc.) y `JournalEntryStatus` (Draft, Posted, Cancelled).
      * Invariante estricta de partida doble: $\sum \text{Debe} == \sum \text{Haber}$ validada en tiempo de compilación y ejecución (`ValidatePostingInvariants()`), impidiendo contabilizar asientos descuadrados.
      * Persistencia EF Core: Configuraciones mapeadas al esquema `accounting` (`accounting.journal_entries`, `accounting.journal_entry_lines`), migraciones aplicadas (`AddJournalEntriesAndLinesModule`), repositorio `IJournalEntryRepository` / `JournalEntryRepository` con secuenciador anual `AS-{year}-000001`.
      * CQRS en `EcuNexo.Business`:
        - `ListJournalEntriesQuery` con cálculo en memoria de KPIs (Total Asientos, Contabilizados, Borradores, Volumen Debe acumulado).
        - `GetJournalEntryByIdQuery` para detalle de asientos con líneas.
        - `CreateJournalEntryCommand` para creación de asientos manuales con validación de cuentas imputables activas.
        - `GeneratePurchaseJournalEntryCommand` para contabilización automática de facturas de compra y liquidaciones SRI (Tipo 03), asignando Inventario/Gasto, Crédito Tributario IVA (15%) y Pasivo de Proveedores Locales.
      * Endpoints REST V1 en `/api/v1/tenants/{tenantId}/accounting/journal-entries` con RBAC conforme a regex (`contabilidad.asientos.read`, `contabilidad.asientos.manage`).
      * Tests backend: 294 pruebas pasando al 100% (203 Core + 91 Business incluyendo DI y Handlers).
    - **Frontend (`ecunexo_admin`):**
      * Nueva Skill creada: [`.agents/skills/ui-vistas-sobre-modales/SKILL.md`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/ui-vistas-sobre-modales/SKILL.md) y Regla 9 en `GEMINI.md` priorizando páginas dedicadas sobre popups para formularios de 3+ campos o procesos operativos.
      * Vista de listado [`JournalEntriesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/JournalEntriesListPage.tsx): Conectada a la API real bajo `/contabilidad/asientos`, 4 StatCards en `.ecu-stat-grid`, filtros por estado/búsqueda y tabla responsive con verificación de cuadre.
      * Vista dedicada de creación [`JournalEntryCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/JournalEntryCreatePage.tsx): Página completa bajo `/contabilidad/asientos/nuevo` (sin modal), selector de cuentas auxiliares imputables, grilla dinámica de apuntes Debe/Haber y cálculo reactivo de cuadre en tiempo real.
      * Rutas enlazadas en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx).
      * Suite E2E Playwright: 6/6 tests pasando en `tests-ui/comun/contabilidad-ui.spec.ts` y 21/21 en `compras-ui.spec.ts`.
  - **Fase 1: Emisión y Registro de Liquidaciones de Compra SRI (Tipo 03) — Concluida con Testing 100%:**
    - **Backend (`ecunexo_api`):**
      * Generador algorítmico de Clave de Acceso SRI de 49 dígitos Módulo 11 (`SriAccessKeyGenerator.cs`).
      * Invariante legal estricta Art. 48 RCVR: Rechazo y validación bloqueante si el sujeto pasivo emisor posee RUC activo (error `purchases.settlement.supplier_has_ruc`). Solo autorizada para personas naturales sin RUC (Cédula) o extranjeros sin residencia.
      * Endpoints dedicados `GET` y `POST` en `/api/v1/tenants/{tenantId}/purchases/settlements` protegidos con permisos RBAC conformes a regex (`facturacion.liquidacion.compra.read`, `facturacion.liquidacion.compra.issue`, `purchases.documents.read`, `purchases.documents.manage`).
      * Filtrado de comprobantes por `documentType = "03"` en `IPurchaseRepository` y persistencia con clave de acceso autogenerada.
      * Cobertura de tests unitarios: 283 tests pasando al 100% (197 Core + 86 Business).
    - **Frontend (`ecunexo_admin`):**
      * Vista de emisión [`PurchaseSettlementCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementCreatePage.tsx): Formulario M3 con validación preventiva inmediata Art. 48 RCVR (banner de bloqueo si el proveedor tiene RUC y deshabilitación del botón emitir), desglose de ítems, cálculo reactivo de retención obligatoria del **100% de IVA** y porcentaje de Impuesto a la Renta (AIR 0%, 1%, 1.75%, 2%, 8%, 10%), y resumen económico con neto a desembolsar.
      * Vista de listado [`PurchaseSettlementsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementsListPage.tsx): Conectada a la API real con DataGrid de Glubox, 4 KPIs automáticos (Total, Autorizadas, Borrador, Monto Liquidado) y botón "Nueva Liquidación".
      * Registro de ruta `/compras/liquidaciones/nueva` en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx).
      * Suite E2E Playwright: 21 tests pasando al 100% en `tests-ui/comun/compras-ui.spec.ts`.
  - **Plan de Arquitectura Contable NIIF, Cierre Tributario SAS y Liquidaciones SRI Tipo 03:**
    - Elaboración del plan minucioso en 4 fases: Emisión de Liquidaciones (Tipo 03 SRI), Asientos Contables Automáticos (Libro Diario), Pre-declaración mensual F104/F103/ATS y Estados Financieros oficiales SCVS (P&G y Balance General).
    - Actualización del skill `.agents/skills/compras-ecuador-sri/SKILL.md` integrando normativa del Art. 48 RCVR, retención del 100% de IVA y sincronización con el catálogo NIIF.
  - **Refactor UI de Formularios y Modales en Contabilidad (`AccountModal.tsx`):**
    - Corrección de anomalías visuales en el modal de cuentas: eliminación de contenedores y estilos inline rígidos, integración de `.ecu-customer-form` y `.ecu-customer-form__grid`.
    - Estandarización de componentes Glubox (`TextBox`, `Select`) con `labelPosition="outlined"` y `variant="outline"`.
    - Eliminación de cajas toscas en checkboxes sustituyéndolas por `CheckButton` y `.ecu-customer-form__hint`.
    - Estandarización de acciones nativas del `<Popup>` con la prop `actions` y banner informativo para cuentas protegidas SCVS.
  - **Blindaje de Permisos RBAC y Estado de Firma SRI en Compras:**
    - Retiro de botones redundantes de configuración de firma en vistas operativas de Retenciones y Liquidaciones de Compra (`PurchaseWithholdingsListPage.tsx`, `PurchaseSettlementsListPage.tsx`), preservando la seguridad y segregación de funciones (la configuración de firma electrónica es potestad exclusiva de Ajustes de Empresa con permisos de rol de administración).
    - Eliminación completa de términos técnicos crudos `.p12` de la interfaz de emisión de facturas (`FacturaEmitirPage.tsx`).
    - Incorporación de insignias informativas de estado SRI y firma electrónica (`SRI Pruebas / SRI Producción` y `Firma Digital Activa / Sin Firma / Expirada`).
  - **Sincronización Criptográfica con Licenciamiento de Producción (license.ecunexo.com):**
    - Extracción de la clave pública oficial RSA-PSS SHA-256 desde el endpoint `GET /api/v1/platform/public-key` de la plataforma de licencias de producción.
    - Actualización en el backend del Cliente (`license-public.pem` y `appsettings.json` `LicenseValidation:SigningPublicKeyPem`) erradicando el error `license.artifact.signature` ("La firma de la licencia no es válida").
  - **Unificación Canónica del Módulo «Compras»:**
    - Normalización de denominaciones en `ModuleDependencyGraph.cs`, `MenuCatalogSeedData.cs` y `ModuleTierCatalog.cs`, consolidando «Compras, Gastos & Recepción SRI» bajo la denominación canónica «Compras».
    - Mantenimiento integral de los flujos de recepción de facturas electrónicas XML 01 y diferenciación de compras de inventario vs. gastos de servicios directos dentro del mismo módulo técnico `purchases`.
  - **Rediseño UI/UX de Ampliación de Licencia (`ApplyLicenseSection.tsx`):**
    - **Resolución de Asimetría Vertical y Dead Space:** Sustitución de la cuadrícula desequilibrada (input de 40px vs dropzone de 180px) por un flujo guiado en 2 columnas con numeración de pasos (`1` Código de activación, `2` Archivo de licencia).
    - **Tarjeta de Guía Criptográfica:** Inclusión de panel informativo con icono de clave y reglas de correspondencia obligatoria para equilibrar la columna izquierda.
    - **Previsualización Estructurada de Licencia Detectada:** Al cargar el archivo `.ecunexo-license`, se reemplazó el texto plano corrido por una tarjeta M3 con badge del plan (`Enterprise-plus`, etc.) y chips individuales (`.ecu-plan-page__chips`) formateados con nombres legibles (`moduleLabel`), suprimiendo el helperText plano de FileBox.
    - **Integración con `SectionCard`:** Unificación visual con el resto de `OrganizationPlanPage`, tipografía monoespaciada para el serial de activación, indicador de estado reactivo y botón `Actualizar Licencia` con icono `KeyRound`.
  - **Control de Ingreso a Bodega sin Factura & Blindaje Legal/Tributario del Proveedor:**
    - **Análisis Jurídico-Tributario (SRI Ecuador):**
      * Neutralidad de la herramienta informática: el proveedor SaaS no es sujeto pasivo tributario ni solidariamente responsable por las operaciones materiales de sus clientes (Código Orgánico Tributario, Arts. 24 a 28; LRTI y COIP Art. 298 sobre defraudación tributaria).
      * El software provee una herramienta estándar requerida para inventarios iniciales, mermas, ajustes de conteo y devoluciones sin comprobante SRI cruzado.
    - **Pilar 1: Trazabilidad Estricta & Kárdex Inmutable:**
      * Auditoría forense mediante `IAuditable` (`created_by`, `created_at`, `approved_by`, `approved_at`, `warehouse_id`, `receipt_origin` y `notes`), permitiendo delimitar exactamente qué usuario de la empresa dio de alta o aprobó cada lote físico.
    - **Pilar 2: Tipificación Transparente de Movimientos:**
      * `InventoryReceiptOrigin` diferencia explícitamente `Purchase` (factura SRI obligatoria validada con formato `001-001-000000123`) de `Opening`, `Return` y `Other` (movimientos internos sin crédito tributario).
    - **Pilar 3: Alerta Preventiva en UI (`CreateInventoryDocumentPage.tsx`):**
      * Inclusión de banner contextual `.ecu-info-banner` cuando el origen es interno (sin factura SRI), recordando que no genera crédito fiscal ni sustituye una factura SRI, y que la empresa es la única responsable del sustento documental.
    - **Pilar 4: Cláusula Contractual de Deslinde en Términos y Condiciones (`legalTermsContent.ts`):**
      * Adición formal de la Sección 8 ("Control de Inventarios, Bodegas y Movimientos de Stock sin Sustento Tributario") con declaración de no certificación de procedencia tributaria, exoneración total y retención de bitácoras de auditoría ante requerimientos judiciales.
  - **Plan General de Cuentas Contables NIIF / SCVS Ecuador & Sinergia con Compras:**
    - **Catálogo Oficial SCVS Ecuador (`StandardEcuadorChartOfAccounts`):**
      * Catálogo maestro estándar de 45 cuentas jerárquicas conforme al marco oficial de la Superintendencia de Compañías, Valores y Seguros del Ecuador (NIIF para PYMES).
      * Cuentas organizadas por grupos: 1. Activo (Caja, Bancos, Clientes, Inventarios/Kárdex, Crédito Tributario IVA Compras/AIR), 2. Pasivo (Proveedores Locales/Exterior, Anticipos Clientes, Retenciones por Pagar SRI, IESS), 3. Patrimonio (Capital Social, Reservas, Utilidad del Ejercicio), 4. Ingresos (Ventas 15%, Ventas 0%, Taller/Servicios) y 5. Costos y Gastos (Costo de Mercaderías Vendidas, Gastos de Personal, Arriendos, Servicios Básicos, Publicidad/Marketing, Fletes/Couriers, Comisiones).
    - **Dominio & Base de Datos:**
      * Entidad `Account` con `AccountType` (Asset, Liability, Equity, Revenue, Expense), `AccountNature` (Debit, Credit), cálculo de nivel jerárquico por código decimal, inferencia de cuenta padre y control de movimiento transaccional.
      * Migración EF Core `20260913212005_AddAccountingAccountsModule` en esquema `accounting`, tabla `accounts`, con índices por tenant, código único y tipo de cuenta.
      * Repositorio `IAccountRepository` en `EcuNexo.Data/Repositories/AccountRepository.cs`.
    - **CQRS Commands & Queries:**
      * `SeedStandardEcuadorPlanCommand`: Semillero seguro que inserta el catálogo oficial SCVS sin duplicar registros y enlazando las cuentas de mayor a sus auxiliares.
      * `ListAccountsQuery`, `CreateAccountCommand`, `UpdateAccountCommand`, `DeleteAccountCommand`.
      * Endpoints REST V1 en `/api/v1/tenants/{tenantId}/accounting/accounts` protegidos por permisos RBAC conformes a regex `^[a-z0-9]+(\.[a-z0-9]+)*$` (`contabilidad.plan.contable.read`, `contabilidad.plan.contable.manage`, `contabilidad.cuentas.read`, `contabilidad.cuentas.manage`).
    - **Frontend (Glubox & Material Design 3):**
      * Vista [`ChartOfAccountsPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/ChartOfAccountsPage.tsx) con PageHeader, KPIs M3 dentro de `<div className="ecu-stat-grid">`, filtros por Grupo NIIF y cuentas imputables, DataGrid jerárquico con indentación por nivel, código monoespaciado y badges de naturaleza/imputabilidad.
      * Modal [`AccountModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/accounting/AccountModal.tsx) para crear y editar cuentas con inferencia reactiva de tipo y naturaleza según el primer dígito del código contable.
      * Rutas enlazadas en [`routes.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/router/routes.tsx) para `/contabilidad/plan-contable` y `/contabilidad/cuentas`.
    - **Pruebas Automatizadas:**
      * 192 pruebas en `EcuNexo.Core.UnitTests` y 84 pruebas en `EcuNexo.Business.UnitTests` (276 tests backend al 100%).
      * 4 pruebas de UI en Playwright (`tests-ui/comun/contabilidad-ui.spec.ts`) y 18 pruebas en (`tests-ui/comun/compras-ui.spec.ts`) pasando al 100%.
  - **Optimización de Importación de Compras, Detección de Duplicados & Sinergia con Bodega:**
    - **Prevención de XMLs Duplicados (Backend & Frontend):**
      * Detección estricta de comprobantes repetidos en cola (por clave de autorización de 49 dígitos o combinación RUC proveedor + secuencial), omitiendo cargas redundantes con aviso claro al usuario.
      * Verificación bidireccional contra base de datos en `ParseSriPurchaseXmlHandler` y bloqueo contra duplicidad en `CreatePurchaseHandler` (`purchases.authorization_number.duplicate`).
      * Indicador visual en grilla con badge `Ya en Sistema`, deshabilitación de selección para importación masiva y alertas explicativas.
    - **Simplificación Visual y Eliminación de Información Redundante:**
      * Depuración de alertas en la auditoría preventiva SRI: eliminación de las 4 cajas repetitivas que duplicaban la información de las métricas KPI, reemplazándolas por un banner limpio de auditoría aprobada (`.ecu-audit-clean-banner`) y reservando las alertas exclusivamente para advertencias, contingencias o inconsistencias reales.
    - **Ocultamiento Condicional del Selector de Bodega y Sinergia con Bodega:**
      * Si la compra no maneja existencias (servicios o líneas sin stock), se oculta por completo el `<Select>` de bodega predeterminada para no generar confusión visual, adaptando el layout a 2 columnas.
      * En facturas con múltiples productos (bienes y gastos en el mismo comprobante), cada línea dispone de un selector individual para definir si es Mercadería (Stock) o Gasto Operativo Directo, con botones de asignación masiva rápida.
      * Sinergia total con almacén: los productos que no se homologan en el momento de la importación quedan marcados como `⏳ Pendiente Recepción en Bodega`, registrando la compra contablemente y habilitando su recepción física y kárdex en `ReceivePurchaseModal`.
    - **Columna de Acciones Fija (Sticky / Fixed):**
      * La columna de acciones en la tabla de cola (`.ecu-col-actions-header`, `.ecu-col-actions-cell`) y en la grilla principal de documentos (`ComprasDocumentosPage.tsx` con `sticky: 'right'`) queda permanentemente visible y anclada al desplazarse horizontalmente.
  - **Catálogo Oficial SRI AIR Tabla 3.10 ATS 2026 y Edición Completa de Conceptos (`/compras/categorias`):**
    - **Extracción Autorizada del SRI ATS:** Extracción e integración fiel de la "Tabla 3.10: CONCEPTOS DE RETENCIÓN EN LA FUENTE DE IMPUESTO A LA RENTA (AIR) DESDE 06/AGOSTO/2026" de `Catalogo_ATS.pdf` (creación de [`src/lib/sriAirCatalog.ts`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/lib/sriAirCatalog.ts) con códigos 300 para residentes y 500 para exterior).
    - **Corrección de Códigos Desfasados:** Reemplazo de tarifas erróneas (ej. código 332 corregido de 2% a 0% oficial para RIMPE Negocios Populares y no sujetos a retención; 344 normalizado al código ATS oficial de 4 dígitos `3440` al 3%; adición de `3482` al 5% para comisiones a sociedades, `304A`, `311`, `319`, `322`, `343A`, etc.).
    - **Edición Completa en [`ExpenseTypeModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypeModal.tsx):**
      * Selector categorizado con todas las opciones oficiales de la Tabla 3.10 y opción para código AIR manual.
      * Callout informativo dinámico con código oficial, grupo tributario, descripción íntegra del SRI y notas técnicas aplicables.
      * Botón "Copiar descripción oficial a nombre y notas" para sincronizar la categoría en 1 clic.
      * Flexibilidad total para editar porcentajes (0%, 1%, 1.75%, 2%, 3%, 5%, 10%, 15%, 25%, etc.), fechas de vigencia y sustentos.
      * Las categorías de sistema (`isSystem = true`) permiten modificar libremente todos sus campos tributarios (nombre, sustento, retención AIR, porcentaje, vigencia, notas y estado activo) bloqueando únicamente el código interno para preservar la integridad del ATS.
    - **Visualización Enriquecida en [`ExpenseTypesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypesListPage.tsx):** La columna "Retención AIR (IR)" ahora expone el código AIR, porcentaje con estilo condicional (0% en gris neutro, tarifas gravadas en azul primario) y la descripción oficial del concepto SRI como subtítulo y tooltip.
  - **Despliegue Desacoplado y Clave Pública de Licencias Integrada (`v0.21.1`):**
    - **Clave Pública RSA Integrada:** Empaquetado de `license-public.pem` dentro del proyecto `EcuNexo.Api` y `SigningPublicKeyPem` embebido en `appsettings.json`, eliminando la necesidad de variables o volúmenes externos para la verificación de licencias.
    - **Desacoplamiento de Volúmenes en Docker Compose:** Eliminación de la dependencia forzada de `${LICENSE_KEYS_HOST_PATH}:/keys:ro` en `docker-compose.yml` y configuración de valores por defecto seguros para prevenir fallos de inicio en Portainer ante variables no definidas.
    - **Resolución de Error 502 Cloudflare / Nginx Upstream:** Identificación de `Connection refused` en `http://172.22.0.3:8080` debido al rechazo por formato de permisos en `MenuCatalogSeedData` (`permission.code.format` por uso de guiones bajos en `purchases.expense_types.*`) y normalización al estándar `purchases.expenses.*`.
    - **Alineación de Layout y Cuadrícula de KPIs (`.ecu-stat-grid`):** Corrección de apilamiento vertical de tarjetas `StatCard` en `ImportPurchasesPage.tsx` mediante el contenedor estándar `.ecu-stat-grid` y layout fluido `.ecu-dashboard-layout--fluid`. Actualización de la skill `glubox-enterprise-ui` y regla 2 de `GEMINI.md`.
    - **Registro de Handlers CQRS en Inyección de Dependencias (`EcuNexo.Business/DependencyInjection.cs`):**
      * Corrección de `InvalidOperationException` al actualizar/eliminar categorías de gasto registrando `UpdateExpenseTypeHandler` y `DeleteExpenseTypeHandler` en `services.AddBusiness()`.
      * Creación de test automatizado por reflexión `DependencyInjectionTests.cs` en `EcuNexo.Business.UnitTests` que valida que el 100% de los `ICommandHandler<,>` e `IQueryHandler<,>` concretos estén registrados en el contenedor IoC (76 pruebas en Business y 182 en Core pasando al 100%).
  - **Vista Dedicada de Importación de Compras & Auditoría Preventiva SRI (`/compras/documentos/importar`):**
    - **Transición de Modal a Vista Propia:** Reemplazo de `ParseXmlModal` por una pantalla completa dedicada con amplio espacio horizontal y vertical para procesar tanto cargas individuales como masivas por lotes de múltiples archivos XML simultáneos.
    - **Auditoría Preventiva del SRI (`SriPurchaseAuditor` & `SriValidationReport`):**
      * Verificación algorítmica de la Clave de Acceso de 49 dígitos con el algoritmo Módulo 11 (ponderaciones 7 a 2) alertando si el dígito verificador está corrupto o mal generado por el emisor.
      * Detección de estado ante el SRI y contingencia: Alertas preventivas para comprobantes sin constancia oficial de autorización (`<autorizacion> / <estado>AUTORIZADO</estado>`), emitidos durante caídas o indisponibilidad del SRI, comprobantes en proceso o devueltos/rechazados.
      * Auditoría aritmética de cuadre: Verificación entre la suma de bases imponibles (tarifa 0%, gravada, no objeto, exenta), IVA liquidado, descuentos e Importe Total declarado en la cabecera.
      * Verificación de vigencia de tarifas SRI: Detección de la tarifa general vigente de IVA del 15% (desde abril 2024), 5% construcción y tarifa 0%, con advertencias preventivas si el proveedor emitió con tarifas desfasadas (12% o 14%).
      * Soporte para Facturas Físicas Preimpresas: Flexibilización en `Purchase.Create` para aceptar números de autorización de 10 dígitos (imprenta SRI) y 49 dígitos (electrónica).
    - **Distinción de Bienes vs Servicios y Reestructuración en Dos Vistas de Importación:**
      * **Bienes vs Servicios:** Las categorías y comprobantes de servicios (fletes, encomiendas Servientrega, courier, arriendos, honorarios, etc.) no manejan stock ni requieren ingreso a bodega. Si la categoría tiene `affectsInventory = false`, el selector de bodega se inhabilita con aviso explicativo, el stock se fija en `Sin Stock (Servicio)` y la compra se registra directamente en estado `Invoiced` (Facturado) sin quedar bloqueada en bodega.
      * **UI Dividida en Dos Vistas:** La vista de importación `/compras/documentos/importar` se rediseñó en dos modos limpios:
        1. **Modo Cola/Grid Principal (`queue`):** Ancho completo con toolbar superior (+ Cargar más XMLs, Pegar XML, Factura Física, Vaciar Cola), KPI cards, DataGrid espacioso con clasificación Bien/Servicio y botón "Configurar / Auditar".
        2. **Modo Detalle/Auditoría (`detail`):** Vista de inspección profunda con botón destacado "← Volver a la Cola de Facturas", paginador rápido entre facturas del lote, auditoría SRI Módulo 11 y tabla completa de líneas.
      * **Detección Automática por Emisor:** Comprobantes de empresas de courier/encomiendas (Servientrega, Laar, Urbano, etc.) y telecomunicaciones/cloud se asignan automáticamente a su categoría de servicio correspondiente al cargar el XML.
    - **Auditoría Global de Selectores de Fecha (`DateBox` de Glubox en todo el sistema):**
      * Se auditó todo el repositorio frontend en búsqueda de inputs nativos `type="date"` que desplegaban el datepicker nativo transparente y desalineado del navegador.
      * Reemplazo sistemático por `<DateBox ... />` de Glubox en todos los formularios identificados:
        1. [`ExpenseTypeModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypeModal.tsx) (Vigencia Desde y Vigencia Hasta).
        2. [`PurchaseProformaModal.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaModal.tsx) (Fecha de Emisión y Válida hasta).
        3. [`PurchaseProformaCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaCreatePage.tsx) (Fecha de Emisión y Vencimiento / Vigencia de Precios).
        4. [`InvoiceIssuerFields.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/facturacion/InvoiceIssuerFields.tsx) (Fecha de Emisión en emisión de facturas).
        5. [`ImportPurchasesPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ImportPurchasesPage.tsx) (Fecha de Emisión en ingreso de factura física).
      * Con esta normalización, el 100% de los campos de fecha del frontend utilizan los componentes oficiales de Glubox (`DateBox` y `RangeDateBox`).
    - Detección determinista por dígito 24 de la clave de acceso de 49 dígitos (`accessKey[23] === '1'` para Pruebas, `'2'` para Producción).
    - **RIDE PDF:** Incorporación de banner superior prominente de alerta (`AMBIENTE DE PRUEBAS — DOCUMENTO SIN VALIDEZ TRIBUTARIA`), marca de agua diagonal de seguridad (`PRUEBAS — SIN VALIDEZ TRIBUTARIA`), indicativo en cabecera junto al número (`[AMBIENTE DE PRUEBAS — SIN VALIDEZ TRIBUTARIA]`), y etiquetado resaltado en el campo Ambiente (`PRUEBAS (SIN VALIDEZ TRIBUTARIA)`).
    - **Grilla de Comprobantes (`FacturasGrid`):** Nueva columna `Ambiente` con badge específico (`🧪 Pruebas (Sin validez)`, `🚀 Producción`, `Borrador`) y tooltip explicativo.
    - **Modal de Previsualización (`InvoiceRidePreviewPopup`):** Badges dinámicos según el ambiente del comprobante con alertas contextuales sobre la validez fiscal.
    - **Dashboard de Comprobantes (`ComprobantesPage`):** Desglose explícito en las KPI StatCards de comprobantes en Producción vs Pruebas.
  - **Corrección de Configuración Legal y Firma SRI (`ContabilidadSriConfigPage`):**
    - Implementación completa de `UpdateTenantSriLegalHandler` en el backend (reemplazando el stub que devolvía 403 `Results.Forbid()`).
    - Soporte para `TradeName` (Nombre Comercial) en comando y validaciones.
    - Ajuste en frontend para invocar el endpoint `/api/v1/tenants/{tenantId}/sri-legal` directamente.
    - Corrección en el cálculo de completitud de la barra de progreso (100% y badge "Listo" al tener datos fiscales y certificado digital válido).
  - **Corrección y Soporte Total de XML de Facturas de Compra SRI (`SriPurchaseXmlParser`):**
    - Soporte completo para XML envueltos en respuestas oficiales del WebService SRI (`<ns2:RespuestaAutorizacion>` y `<autorizacion>`), con comprobantes embebidos en CDATA o texto escapado (`&lt;factura...`).
    - Navegación agnóstica de namespaces XML para elementos y atributos SRI (`infoTributaria`, `infoFactura`, `detalles`, `impuestos`).
    - Detección y decodificación automática de entidades HTML/XML si el usuario copia texto escapado.
    - Respaldo de dirección matriz con `dirEstablecimiento` si `dirMatriz` no viene en `infoTributaria`.
    - Auto-creación transparente del proveedor en el directorio (`ParseXmlModal.tsx`) si el RUC/Cédula es nuevo, resolviendo el `supplierId` antes de registrar la compra.
  - **Fortalecimiento de Reglas de Negocio en Compras (Fases 1 y 2):**
    - **Proveedores:** Flexibilización de correo electrónico en [`Supplier.Create`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Core/Purchases/Supplier.cs) y `Update` (correo opcional para total compatibilidad con XMLs del SRI que no incluyen el emisor; validación de formato solo si se proporciona).
    - **Facturas de Compra:** Validación de formato SRI (`^\d{3}-\d{3}-\d{9}$`) con auto-normalización de números continuos de 15 dígitos (`001002000123456` -> `001-002-000123456`), prohibición de fechas de emisión futuras, e imposibilidad de subtotales/totales negativos.
    - **Recepción en Bodega y Kárdex (`ReceivePurchaseModal.tsx`):** Selector de productos de catálogo por línea para vincular cualquier ítem que no haya sido homologado previamente, asegurando la creación correcta del `InventoryDocument` de ingreso y la actualización del costo promedio ponderado en el kárdex contable.
    - **Gestión Completa, Edición y Vigencia del Catálogo de Categorías / Conceptos de Compra SRI (`expense_types`):**
    - **Entidad de Dominio (`ExpenseType`):** Incorporación de campos oficiales de porcentaje de retención (`RetentionPercentage`), fecha inicio de vigencia (`ValidFrom`, ej. `2026-08-06`) y fin de vigencia (`ValidUntil`), con validación de invariantes de fechas y porcentaje (0-100%).
    - **Base de Datos & Migración EF Core:** Aplicada migración `20260913175114_AddVigenciaAndPercentageToExpenseTypes` en PostgreSQL schema `purchases.expense_types`.
    - **CQRS Handlers:** Implementados `UpdateExpenseTypeHandler` y `DeleteExpenseTypeHandler` (protección de conceptos `IsSystem` contra borrado destructivo pero permitiendo desactivación y edición de nombres/tarifas; descarte físico sólo si no existen compras asociadas, y desactivación preventiva si ya fue usado).
    - **Endpoints API:** `PUT` y `DELETE` en `/api/v1/tenants/{tenantId}/purchases/expense-types/{id}` expuestos y documentados en Swagger.
    - **Frontend (`ExpenseTypeModal.tsx` & `ExpenseTypesListPage.tsx`):** Modal completo Glubox para crear y editar conceptos, selector de códigos AIR del SRI con autocompletado de porcentajes y fechas vigentes (desde agosto 2026), columnas en DataGrid con `% Retención AIR`, `Vigencia SRI` y botones de acción (Editar y Desactivar/Eliminar con confirmación segura).
  - **Seguridad & Endurecimiento de Permisos RBAC en Compras:**
    - Eliminado el bypass temporal de `facturacion.read` en endpoints de escritura (`POST`, `PUT`, `DELETE`, `/receive`, `/seed`, `/parse-xml`, `/approve`, `/reject`) en [`ExpenseTypeEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/ExpenseTypeEndpoints.cs), [`SupplierEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/SupplierEndpoints.cs), [`PurchaseEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/PurchaseEndpoints.cs) y [`PurchaseProformaEndpoints.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Endpoints/V1/Purchases/PurchaseProformaEndpoints.cs).
    - Alineados todos los componentes y páginas frontend de compras ([`ComprasDocumentosPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ComprasDocumentosPage.tsx), [`SuppliersListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/SuppliersListPage.tsx), [`ExpenseTypesListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/ExpenseTypesListPage.tsx), [`PurchaseProformasListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformasListPage.tsx), [`PurchaseProformaCreatePage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseProformaCreatePage.tsx), [`PurchaseWithholdingsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseWithholdingsListPage.tsx), [`PurchaseSettlementsListPage.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/compras/PurchaseSettlementsListPage.tsx)) para evaluar estrictamente los permisos granulares `purchases.*` en lugar de conceder accesos por facturación de ventas.
    - Menú padre "Compras" en [`MenuCatalogSeedData.cs`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_api/src/EcuNexo.Api/Development/MenuCatalogSeedData.cs) configurado con permisos abiertos para que cualquier usuario con permiso a al menos una de las subsecciones (facturas, proveedores, proformas, retenciones o categorías) pueda acceder a su área autorizada sin exigir forzosamente `purchases.documents.read`.
  - **Seguridad:**
    - Eliminado archivo `.pem` del repositorio, configurado `.gitignore` y `appsettings.Development.local.json`.

---

## 2. Objetivos y Alcance del Módulo de Compras

1. **Directorio de Proveedores (`/compras/proveedores`):**
   * Maestro de proveedores con validación de identificación (RUC Sociedades Módulo 11, RUC Personas Módulo 10, Cédula).
   * Parámetros tributarios SRI: Régimen General, RIMPE Emprendedor, RIMPE Negocio Popular, Contribuyente Especial, Agente de Retención.
   * Gestión de proformas/cotizaciones comerciales por proveedor con anexos PDF/imagen en Cloud Storage.
2. **Catálogo y Tipos de Gasto SRI (`expense_types`):**
   * Semillero (Seed) de gastos estándar para e-commerce y empresas: Mercadería para venta (Inventario), Empaque y embalaje, Publicidad/Marketing digital, Hosting/Cloud SaaS, Honorarios, Arriendos, Servicios básicos, Activo fijo.
   * Mapeo transparente hacia los códigos de sustento de crédito tributario del SRI (Tabla 5 ATS: `01`, `02`, `03`).
3. **Ingreso y Sustentación de Facturas de Proveedores:**
   * Importación/parseo automático de XML de facturas electrónicas SRI (Tipo 01) y consulta por clave de acceso de 49 dígitos.
   * Afectación automática y directa a Bodegas e Inventario físico (Ingreso de stock y kárdex promedio ponderado).
4. **Emisión de Comprobantes de Retención Electrónica (SRI Tipo 07):**
   * Estructura XML versión 2.0.0 (Anexo 10 ATS de la Ficha Técnica Offline v2.32).
   * Cálculo automático de retenciones de Renta (códigos 312, 343, 304, 303/3440, etc.) e IVA (30%, 70%, 100%).
   * Firma digital XAdES-BES (`.p12`), transmisión SOAP y emisión de RIDE PDF.
5. **Liquidaciones de Compra (SRI Tipo 03):**
   * Para adquisición a personas sin RUC autorizadas por normativa ecuatoriana.

---

## 3. Decisiones de Arquitectura & Rutas

* **Frontend (`ecunexo_admin`):**
  * Rutas bajo `/compras/*`:
    * `/compras/documentos` (Listado unificado con pestañas o filtros por tipo).
    * `/compras/proveedores` (Directorio de proveedores y fichas de contacto).
    * `/compras/proformas` (Gestión de cotizaciones por proveedor).
    * `/compras/gastos-tipos` (Catálogo maestro de tipos de gasto y sustentos SRI).
  * Estilo y layout: Cumplimiento estricto de `glubox-enterprise-ui` (PageHeader → KPI StatCards → SectionCard → DataGrid).
* **Backend (`ecunexo_api`):**
  * Dominio en `EcuNexo.Core/Purchases/` o subdominios `Suppliers`, `Expenses`, `Purchases`.
  * Persistencia en PostgreSQL mediante EF Core con migraciones versionadas.
  * Reutilización del motor de firma XAdES-BES y web services SRI del subsistema de facturación.

---

## 4. Skills de Consulta Rápida (Disponibles en `.agents/skills/`)

* [`compras-ecuador-sri`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/compras-ecuador-sri/SKILL.md): Ficha Técnica SRI v2.32, XML Retención v2.0.0, códigos ATS e impuestos.
* [`proveedores-proformas`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/proveedores-proformas/SKILL.md): Entidad proveedor, validaciones y ciclo de vida de proformas.
* [`inventario-bodegas-kardex`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/inventario-bodegas-kardex/SKILL.md): Enlace de compras con kárdex ponderado y saldos por bodega.
* [`ecommerce-pedidos-stock`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/ecommerce-pedidos-stock/SKILL.md): Stock disponible para la tienda web tras compras.
* [`glubox-enterprise-ui`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/glubox-enterprise-ui/SKILL.md): Directrices visuales y componentes atómicos glubox.
* [`semantic-versioning`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/semantic-versioning/SKILL.md): Protocolo de versionamiento semántico bajo demanda explícita.
* [`licenciamiento-modulo-prompt`](file:///home/solivo/Documentos/ecunexo/Cliente/.agents/skills/licenciamiento-modulo-prompt/SKILL.md): Generación obligatoria de prompts estandarizados para el módulo de licencias al crear nuevos módulos de negocio.

---

## 5. Plan de Ejecución Inmediato (Fases con Testing Obligatorio)

* [x] **Fase 1: Dominio y Base de Datos (Proveedores, Tipos de Gasto SRI & Proformas):**
  * Entidades `Supplier`, `ExpenseType` (con seed inicial SRI de 8 categorías ATS) y `PurchaseProforma`.
  * Repositorios `ISupplierRepository`, `IExpenseTypeRepository`, `IPurchaseProformaRepository`.
  * Migración EF Core `20260913023206_AddPurchasesAndSuppliersModule` (esquema `purchases`).
  * **Unit Tests (Core):** `SupplierTests.cs` y `ExpenseTypeAndProformaTests.cs` en `EcuNexo.Core.UnitTests` (147 pruebas en verde).
* [x] **Fase 2: Endpoints y CQRS Handlers en Backend:**
  * Comandos y queries para CRUD de proveedores, siembra/listado de tipos de gasto y flujo de proformas (Draft -> Approved/Rejected).
  * Endpoints REST en `SupplierEndpoints.cs`, `ExpenseTypeEndpoints.cs`, `PurchaseProformaEndpoints.cs` con políticas de permisos `purchases.*` y catálogo de menús (`MenuCatalogSeedData.cs`).
  * **Unit Tests (Business):** `SupplierHandlersTests.cs`, `ExpenseTypeHandlersTests.cs`, `PurchaseProformaHandlersTests.cs` en `EcuNexo.Business.UnitTests` (53 pruebas en verde, total backend 200 pruebas).
* [x] **Fase 3: Frontend UI Directorio de Proveedores, Proformas & Tipos de Gasto:**
  * Validador SRI en tiempo real: `ecuadorTaxIdValidator.ts` (Módulo 10 y Módulo 11 para Cédula, RUC Natural, RUC Privada, RUC Pública, Pasaporte).
  * Cliente API completo: `purchasesApi.ts`.
  * Vistas y modales cumpliendo Enterprise UI / glubox:
    * `/compras/proveedores`: `SuppliersListPage.tsx` (KPIs, DataGrid, búsqueda, modal `SupplierModal.tsx` con validación RUC interactiva).
    * `/compras/proformas`: `PurchaseProformasListPage.tsx` (KPIs, estados, modal `PurchaseProformaModal.tsx` con desglose dinámico de ítems e impuestos IVA 15%/5%/0%).
    * `/compras/gastos`: `ExpenseTypesListPage.tsx` (KPIs, códigos ATS, botón de siembra oficial SRI).
  * Rutas configuradas en `routes.tsx` e iconos en `sidebarIcons.tsx`.
  * **Frontend Tests:** Suite Playwright `tests-ui/comun/compras-ui.spec.ts` (13 pruebas unitarias y de navegación E2E pasando al 100%, build de Vite en verde sin errores de tipado).
* [x] **Fase 4: Registro de Facturas de Compra & Parseo XML SRI:**
  * **Backend:**
    * Entidades de dominio `Purchase` y `PurchaseItem` en `EcuNexo.Core/Purchases/`.
    * Servicio `SriPurchaseXmlParser` que interpreta comprobantes `<factura>` (v1.0.0, v1.1.0) y sobres SOAP SRI `<autorizacion><comprobante><![CDATA[...]]></comprobante></autorizacion>`, extrayendo emisor, comprador, clave de acceso de 49 dígitos, fechas, desglose tributario y líneas de productos.
    * Persistencia EF Core (`PurchaseConfiguration.cs`, esquema `purchases`, migración `20260913030153_AddPurchasesInvoicesAndItems.cs`).
    * CQRS Commands & Queries: `ParseSriPurchaseXmlCommand`, `CreatePurchaseCommand`, `ReceivePurchaseCommand` (enlaza y aprueba automáticamente documentos de recepción física actualizando existencias y kárdex promedio ponderado por bodega), `ListPurchasesQuery` y `GetPurchaseByIdQuery`.
    * Endpoints REST en `PurchaseEndpoints.cs` (`/api/v1/tenants/{tenantId}/purchases/documents`).
    * **Backend Unit Tests:** 211 tests en verde (154 Core + 57 Business).
  * **Frontend:**
    * Funciones API en `purchasesApi.ts` (`listPurchases`, `getPurchaseById`, `parseSriPurchaseXml`, `createPurchase`, `receivePurchase`).
    * Vistas y modales:
      * `ComprasDocumentosPage.tsx`: PageHeader (sin botones duplicados, Regla 3), KPIs (Total Facturas, Mercadería Recibida, En Borrador, Total Facturado), filtros y DataGrid.
      * `ParseXmlModal.tsx`: Carga/pegado de XML SRI, análisis automático, homologación con ítems del catálogo y selección de bodega.
      * `ReceivePurchaseModal.tsx`: Recepción física de mercadería en almacén y afectación a kárdex.
      * `PurchaseDetailModal.tsx`: Consulta detallada de la factura, impuestos y líneas.
    * **Frontend Tests:** 17 tests unitarios y E2E en Playwright (`tests-ui/comun/compras-ui.spec.ts`) pasando al 100%, `npm run build` con 0 errores TypeScript.
* [x] **Fase 5: Arquitectura de Firma Electrónica (.p12) Cifrada en Base de Datos (AES-256-GCM):**
  * **Almacenamiento Cifrado en PostgreSQL:**
    * Entidad `TenantSigningCertificate` en `EcuNexo.Core/Tenancy/` con campos `encrypted_data` (bytea), `encrypted_password` (bytea), `nonce` (12 bytes), `tag` (16 bytes) y metadatos del titular (`subject`, `issuer`, `valid_from`, `valid_to`, `subject_tax_id`, `serial_number`, `original_file_name`, `is_active`).
    * Servicio de cifrado autenticado `AesGcmCertificateEncryptionService` (AES-256-GCM con clave maestra derivada o por configuración).
    * Validador en memoria `SigningCertificateValidator` usando `X509CertificateLoader.LoadPkcs12` (.NET 10) con `EphemeralKeySet`, comprobando presencia de clave privada, vigencia y extrayendo el RUC/titular.
    * Repositorio `TenantSigningCertificateRepository` y mapeo EF Core en tabla `tenancy.tenant_signing_certificates`.
    * Migración aplicada: `20260913053039_AddTenantSigningCertificates`.
    * Endpoints REST en `TenantSigningCertificateEndpoints.cs`:
      * `POST /api/v1/tenants/{tenantId}/signing-certificate`: Carga y validación en memoria del archivo `.p12`/`.pfx`, cifrado AES-GCM y persistencia.
      * `GET /api/v1/tenants/{tenantId}/signing-certificate/status`: Estado del certificado, titular, RUC, días restantes y alerta de expiración.
    * **Backend Unit Tests:** 238 tests en verde al 100% (168 Core + 70 Business), incluyendo pruebas de ida y vuelta de cifrado AES-256-GCM, detección de datos/tags alterados y validación PKCS#12 en memoria.
  * **Frontend (`ecunexo_admin`):**
    * Métodos `getSigningCertificateStatus` y `uploadSigningCertificate` en `src/services/tenantApi.ts`.
    * Interfaz renovada en `SriSignatureSection.tsx` (`Ajustes de Empresa -> Facturación Electrónica`) con tarjeta informativa del certificado activo (AES-256-GCM, titular, RUC, vigencia, días restantes con StatusBadge) y dropzone con botón "Cargar y Validar Firma".
    * Banners dinámicos en `PurchaseWithholdingsListPage.tsx` y `PurchaseSettlementsListPage.tsx` que reflejan en tiempo real el estado de la firma electrónica.
    * `npm run build` en verde con 0 errores TypeScript.
* [ ] **Fase 6: Motor de Emisión de Retenciones SRI (XML 07) & Liquidaciones (XML 03):**
  * Generación de comprobante de retención electrónica versión 2.0.0 (Anexo 10 ATS v2.32), cálculo automático de IR/IVA según condición tributaria del proveedor, firma digital XAdES-BES tomando el `.p12` descifrado en memoria desde la base de datos, transmisión WebServices SOAP SRI y generación de RIDE.
