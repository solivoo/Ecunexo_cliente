using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSkuFromMatrixParents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los ítems raíz (plantillas/modelos) no llevan SKU: solo variantes y productos simples.
            migrationBuilder.Sql(
                """
                UPDATE catalog.items
                SET sku = NULL, updated_at = now()
                WHERE is_matrix_parent = TRUE
                  AND deleted_at IS NULL
                  AND sku IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Limpieza de datos: no se revierte automáticamente.
        }
    }
}
