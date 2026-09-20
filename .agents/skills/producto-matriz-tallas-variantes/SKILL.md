---
name: producto-matriz-tallas-variantes
description: >-
  Estándares de arquitectura, modelo auto-referencial (Parent-Child), generación cartesiana,
  escalas reutilizables de tallas (medias, ropa, calzado) y control de stock independiente para
  Productos Matriz y Variantes en EcuNexo.
---

# Producto Matriz & Variantes Multidimensionales (Parent-Child Matrix SKU)

Esta skill define los estándares técnicos, normativos de inventario y de experiencia de usuario para la gestión de productos con variantes (tallas, colores, medidas, acabados) en EcuNexo.

---

## 1. Principios de Arquitectura de Dominio (Modelo Auto-referencial)

Para evitar duplicar subsistemas o romper la integridad referencial con Facturación SRI, Kárdex, Bodegas o Ecommerce, EcuNexo implementa el patrón **Self-Referencing Entity** en `catalog.items`:

1. **Producto Matriz / Padre (`IsMatrixParent = true`, `ParentId = null`):**
   - Representa el concepto comercial y vitrina del producto (ej: *"Calcetín Deportivo de Algodón"*, *"Camisa Oxford Manga Larga"*, *"Zapato Escolar de Cuero"*).
   - Contiene la descripción general, categoría, imágenes de vitrina, código de modelo (`ModelCode`) y la configuración de dimensiones en JSON (`VariantDimensionsJson`).
   - **Invariante Físico Estricto:** El producto matriz padre **NUNCA** almacena saldo de existencias directo ni movimientos de Kárdex.
2. **Ítem Variante / Hijo (`ParentId = [IdPadre]`, `IsMatrixParent = false`):**
   - Cada variante física es un `CatalogItem` individual con:
     - Nombre contextual: `"{NombrePadre} - {Variacion}"` (ej. *"Calcetín Deportivo de Algodón - 35-38"*).
     - Código SKU obligatorio y único en la empresa (ej. `CALC-01-3538`).
     - Código de barras opcional (EAN-13, UPC o interno).
     - Precio base propio (puede diferir del precio base del padre).
     - Saldo de stock y trazabilidad de Kárdex independiente por bodega.
3. **Integridad Relacional:**
   - En la base de datos PostgreSQL, la clave foránea `parent_id` tiene regla `ON DELETE CASCADE`.
   - La baja lógica (`SoftDelete`) del producto padre inhabilita en cascada todas sus variantes hijas.

---

## 2. Escalas de Variantes y Plantillas Reutilizables (`VariantDimensionTemplate`)

Cada rubro comercial maneja formas distintas de representar sus dimensiones:
- En **calcetería/medias**: rangos agrupados (`35-38`, `39-41`, `42-44`).
- En **confección/ropa**: tallas alfabéticas (`XS`, `S`, `M`, `L`, `XL`, `XXL`).
- En **calzado nacional**: numeración métrica europea/ecuatoriana (`36`, `37`, `38`, `39`, `40`, `41`, `42`, `43`, `44`).
- En **pantalones/jeans**: tallas por pulgadas (`28`, `30`, `32`, `34`, `36`, `38`).
- En **infantil/bebés**: meses y edades (`0-3m`, `3-6m`, `6-12m`, `12-18m`, `2T`, `4T`, `6`, `8`, `10`).

### Invariantes de Plantillas:
1. **Plantillas del Sistema (`IsSystemDefault = true`):**
   - Se precargan automáticamente en el primer acceso del tenant (`Medias / Calcetines (Tallas)`, `Tipo de Caña / Altura (Calcetines)`, `Ropa Adulto`, `Largo de Manga (Camisas)`, `Calzado Adulto`, `Pantalones / Jeans`, `Colores Básicos`).
   - Son **inmutables** (`catalog.variant_template.system.immutable`) y **no eliminables** (`catalog.variant_template.system.cannot_delete`).
2. **Plantillas Personalizadas del Tenant (`IsSystemDefault = false`):**
   - El usuario puede crearlas desde el configurador o guardar una escala modificada.
   - Son 100% editables (`PUT /api/v1/tenants/{tenantId}/catalog/variant-templates/{templateId}`) y eliminables (`DELETE /api/v1/tenants/{tenantId}/catalog/variant-templates/{templateId}`).

---

## 3. Generación Cartesiana Multidimensional (N-Dimensiones) & Sinergia con Categorías

El constructor de variantes ([`VariantMatrixBuilder.tsx`](file:///home/solivo/Documentos/ecunexo/Cliente/ecunexo_admin/src/pages/catalog/VariantMatrixBuilder.tsx)) opera de forma completamente dinámica:
1. **Soporte para N-Dimensiones Arbitrarias:**
   - Permite agregar hasta 4 dimensiones dinámicas (`+ Añadir Dimensión`) para cubrir cualquier rubro:
     * Calcetería: `Talla` × `Caña / Altura` × `Color`.
     * Confección: `Talla` × `Largo de Manga` × `Color`.
     * Sastrería/Pantalones: `Cintura` × `Largo Inseam` × `Color`.
2. **Producto Cartesiano Dinámico:**
   - Multiplica iterativamente los valores activos de cada dimensión:
     $$D_1 \times D_2 \times \dots \times D_n$$
   - Cada combinación genera un SKU normalizado: `[PREFIJO]-[SAN(D1)]-[SAN(D2)]-[SAN(D3)]`.
3. **Fotografía / Imagen Independiente por Variante:**
   - Cada fila física mantiene su propia miniatura y carga de archivo, preservando la apariencia real de cada combinación.
4. **Sinergia con Atributos de Categoría (`attributeSchemaJson`):**
   - **Atributos de Categoría:** Modelan datos comerciales globales de la familia (ej. `Material`, `Género`, `Temporada`, `Marca`).
   - **Exclusión Dinámica Inteligente:** Cuando un ítem activa variantes, cualquier campo de la categoría cuyo nombre o clave coincida con las dimensiones configuradas en la matriz se excluye automáticamente del formulario del ítem principal. Así se evita exigir un color o talla única en el padre, dejando que cada variante gobierne sus valores independientes.
   - **Atributos No Variantes:** Permanecen en el formulario del ítem principal y aplican a toda la familia.

---

## 4. Estándares en Listados & UI (M3 & Glubox)

1. **Consolidación en Catálogo Principal (`onlyRoots = true`):**
   - Al listar el catálogo general (`/catalogo/items`), la API y la vista filtran por defecto los ítems raíces (`parent_id IS NULL`).
   - Evita que un producto con 15 tallas y 4 colores sature la tabla con 60 filas repetidas.
2. **Insignia de Matriz:**
   - Todo ítem con `isMatrixParent = true` muestra un badge distintivo: `<StatusBadge tone="primary">Matriz · {variantCount} variantes</StatusBadge>` con el icono `<Layers size={13} />`.
   - En móviles, las tarjetas (`renderCard`) muestran el resumen de variantes y el prefijo de modelo.
3. **Acciones Masivas de Creación:**
   - Botón *"Copiar precio base a todas"*: propaga el precio del padre a todas las variantes activas en un clic.
   - Botón *"Regenerar SKUs"*: normaliza los códigos bajo la nomenclatura estándar `[MODELO]-[TALLA]-[COLOR]`.

---

## 5. Trazabilidad e Integración con Otros Módulos

* **Inventario & Kárdex:** Cada variante tiene su propia tarjeta de Kárdex. Si se realiza una toma física de inventario o un traspaso entre bodegas, el documento se asienta sobre el SKU de la variante física específica.
* **Facturación Electrónica SRI:** Al facturar, el usuario busca y selecciona la variante concreta (ej. "Calcetín Deportivo - 39-41"); el comprobante XML del SRI reporta el SKU y precio de dicha variante.
* **Ecommerce / Pedidos:** La vitrina web agrupa las variantes bajo el producto padre con selectores visuales de talla/color, y descuenta atómicamente el stock del SKU hijo seleccionado al confirmar el pago.
