using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillBasePriceToDefaultPriceList : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // El precio comercial vive en listas. Se vuelca `base_price` de los ítems físicos
            // a la lista predeterminada activa de cada empresa (sin duplicar precios vigentes).
            migrationBuilder.Sql(
                """
                INSERT INTO pricing.product_prices
                    (id, tenant_id, price_list_id, catalog_item_id, price, valid_from, valid_to, is_active, created_at)
                SELECT gen_random_uuid(), i.tenant_id, pl.id, i.id, i.base_price, CURRENT_DATE, NULL, true, now()
                FROM catalog.items i
                JOIN pricing.price_lists pl
                  ON pl.tenant_id = i.tenant_id AND pl.is_default = true AND pl.is_active = true
                WHERE i.kind = 0
                  AND i.base_price IS NOT NULL
                  AND i.deleted_at IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM pricing.product_prices pp
                      WHERE pp.catalog_item_id = i.id AND pp.is_active = true
                  );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfill de datos: no se revierte para no perder precios configurados a mano.
        }
    }
}

