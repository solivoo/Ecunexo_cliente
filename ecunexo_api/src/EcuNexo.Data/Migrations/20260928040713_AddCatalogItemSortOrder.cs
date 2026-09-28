using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogItemSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "sort_order",
                schema: "catalog",
                table: "items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Orden inicial de variantes existentes: por fecha de creación dentro de cada producto.
            migrationBuilder.Sql(
                """
                UPDATE catalog.items i
                SET sort_order = ranked.position
                FROM (
                    SELECT id,
                           row_number() OVER (PARTITION BY parent_id ORDER BY created_at, id) - 1 AS position
                    FROM catalog.items
                    WHERE parent_id IS NOT NULL
                ) AS ranked
                WHERE i.id = ranked.id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "sort_order",
                schema: "catalog",
                table: "items");
        }
    }
}
