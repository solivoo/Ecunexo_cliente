using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861


namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogItemBarcode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "barcode",
                schema: "catalog",
                table: "items",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_items_tenant_id_barcode",
                schema: "catalog",
                table: "items",
                columns: new[] { "tenant_id", "barcode" },
                unique: true,
                filter: "\"deleted_at\" IS NULL AND barcode IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_items_tenant_id_barcode",
                schema: "catalog",
                table: "items");

            migrationBuilder.DropColumn(
                name: "barcode",
                schema: "catalog",
                table: "items");
        }
    }
}
