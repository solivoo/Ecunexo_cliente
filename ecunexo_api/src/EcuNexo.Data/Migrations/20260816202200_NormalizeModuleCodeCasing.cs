using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class NormalizeModuleCodeCasing : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE identity.permissions
            SET module = CASE lower(btrim(module))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module))
                END,
                updated_at = now()
            WHERE module IS NOT NULL
              AND module IS DISTINCT FROM CASE lower(btrim(module))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module))
                END;
            """);

        migrationBuilder.Sql(
            """
            DELETE FROM platform.product_modules AS dup
            WHERE EXISTS (
                SELECT 1
                FROM platform.product_modules AS keep
                WHERE keep.code = CASE lower(btrim(dup.code))
                        WHEN 'invoicing' THEN 'facturacion'
                        WHEN 'accounting' THEN 'contabilidad'
                        ELSE lower(btrim(dup.code))
                    END
                  AND keep.code IS DISTINCT FROM dup.code
            );

            UPDATE platform.product_modules
            SET code = CASE lower(btrim(code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(code))
                END
            WHERE code IS DISTINCT FROM CASE lower(btrim(code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(code))
                END;
            """);

        migrationBuilder.Sql(
            """
            DELETE FROM platform.menu_items AS dup
            WHERE dup.id IS DISTINCT FROM lower(btrim(dup.id))
              AND EXISTS (
                  SELECT 1
                  FROM platform.menu_items AS keep
                  WHERE keep.id = lower(btrim(dup.id))
              );

            UPDATE platform.menu_items
            SET parent_id = lower(btrim(parent_id))
            WHERE parent_id IS NOT NULL
              AND parent_id IS DISTINCT FROM lower(btrim(parent_id));

            UPDATE platform.menu_items
            SET id = lower(btrim(id))
            WHERE id IS DISTINCT FROM lower(btrim(id));

            UPDATE platform.menu_items
            SET module_code = CASE lower(btrim(module_code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module_code))
                END
            WHERE module_code IS DISTINCT FROM CASE lower(btrim(module_code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module_code))
                END;
            """);

        migrationBuilder.Sql(
            """
            UPDATE tenancy.module_usage_counters AS dup
            SET module_code = CASE lower(btrim(module_code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module_code))
                END
            WHERE module_code IS DISTINCT FROM CASE lower(btrim(module_code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module_code))
                END
              AND NOT EXISTS (
                  SELECT 1
                  FROM tenancy.module_usage_counters AS keep
                  WHERE keep.tenant_id = dup.tenant_id
                    AND keep.limit_key = dup.limit_key
                    AND keep.module_code = CASE lower(btrim(dup.module_code))
                            WHEN 'invoicing' THEN 'facturacion'
                            WHEN 'accounting' THEN 'contabilidad'
                            ELSE lower(btrim(dup.module_code))
                        END
              );

            DELETE FROM tenancy.module_usage_counters AS dup
            WHERE module_code IS DISTINCT FROM CASE lower(btrim(module_code))
                    WHEN 'invoicing' THEN 'facturacion'
                    WHEN 'accounting' THEN 'contabilidad'
                    ELSE lower(btrim(module_code))
                END;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Corrección de datos irreversible: los códigos canónicos son minúsculas.
    }
}
