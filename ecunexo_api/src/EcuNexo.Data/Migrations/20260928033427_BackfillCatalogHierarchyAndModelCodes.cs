using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillCatalogHierarchyAndModelCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Backfill de hierarchy_path_json para ítems existentes con plantilla (familia) y atributos.
            //    Reproduce la regla del frontend: niveles del árbol, omitiendo el nivel terminal cuando
            //    la plantilla genera variantes (ejes con valores), y omitiendo los ejes como atributos.
            migrationBuilder.Sql(
                """
                WITH item_templates AS (
                    SELECT i.id AS item_id, t.hierarchy_tree_json::jsonb AS tree
                    FROM catalog.items i
                    JOIN catalog.product_templates t ON t.id = i.family_id
                    WHERE i.deleted_at IS NULL
                      AND i.family_id IS NOT NULL
                      AND i.hierarchy_path_json IS NULL
                      AND i.custom_attributes_json IS NOT NULL
                      AND jsonb_typeof(i.custom_attributes_json::jsonb) = 'object'
                ),
                levels AS (
                    SELECT it.item_id, lvl, ord,
                           jsonb_array_length(COALESCE(lvl->'axes', '[]'::jsonb)) > 0 AS level_has_axes
                    FROM item_templates it
                    CROSS JOIN LATERAL jsonb_array_elements(it.tree) WITH ORDINALITY AS l(lvl, ord)
                ),
                level_meta AS (
                    SELECT item_id, count(*) AS total_levels, bool_or(level_has_axes) AS has_any_axes
                    FROM levels
                    GROUP BY item_id
                ),
                axis_names AS (
                    SELECT item_id, lower(trim(ax)) AS axis
                    FROM levels
                    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(lvl->'axes', '[]'::jsonb)) AS ax
                ),
                fields AS (
                    SELECT l.item_id, l.ord, l.lvl->>'name' AS level_name,
                           attr AS name, lower(trim(attr)) AS name_lower,
                           row_number() OVER (PARTITION BY l.item_id ORDER BY l.ord, a.attr_ord) AS field_order
                    FROM levels l
                    JOIN level_meta m ON m.item_id = l.item_id
                    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(l.lvl->'attributes', '[]'::jsonb))
                        WITH ORDINALITY AS a(attr, attr_ord)
                    WHERE NOT (m.has_any_axes AND l.ord = m.total_levels)
                ),
                dedup AS (
                    SELECT f.*, min(field_order) OVER (PARTITION BY item_id, name_lower) AS first_order
                    FROM fields f
                ),
                entries AS (
                    SELECT d.item_id, d.level_name, d.name, kv.value,
                           row_number() OVER (PARTITION BY d.item_id ORDER BY d.first_order) AS rn
                    FROM dedup d
                    JOIN catalog.items i2 ON i2.id = d.item_id
                    CROSS JOIN LATERAL jsonb_each_text(i2.custom_attributes_json::jsonb) kv
                    LEFT JOIN axis_names an ON an.item_id = d.item_id AND an.axis = d.name_lower
                    WHERE d.field_order = d.first_order
                      AND an.axis IS NULL
                      AND lower(kv.key) = d.name_lower
                      AND trim(kv.value) <> ''
                ),
                built AS (
                    SELECT item_id,
                           jsonb_agg(
                               jsonb_build_object('name', name, 'level', level_name, 'value', value)
                               ORDER BY rn) AS path
                    FROM entries
                    GROUP BY item_id
                )
                UPDATE catalog.items i
                SET hierarchy_path_json = built.path
                FROM built
                WHERE i.id = built.item_id;
                """);

            // 2) Código de modelo para plantillas padre (matriz) sin SKU:
            //    slug del nombre + 8 caracteres del id para garantizar unicidad.
            migrationBuilder.Sql(
                """
                UPDATE catalog.items
                SET sku = trim(both '-' from left(
                              regexp_replace(
                                  translate(upper(name), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'),
                                  '[^A-Z0-9]+', '-', 'g'), 24))
                          || '-' || upper(left(replace(id::text, '-', ''), 8))
                WHERE is_matrix_parent = TRUE
                  AND (sku IS NULL OR btrim(sku) = '')
                  AND deleted_at IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfill de datos: no se revierte automáticamente.
        }
    }
}
