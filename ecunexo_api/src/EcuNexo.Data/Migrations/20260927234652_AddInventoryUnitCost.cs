using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryUnitCost : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "average_cost",
                schema: "inventory",
                table: "stocks",
                type: "numeric(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "last_cost",
                schema: "inventory",
                table: "stocks",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_cost",
                schema: "inventory",
                table: "movements",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_cost",
                schema: "inventory",
                table: "document_lines",
                type: "numeric(18,4)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "average_cost",
                schema: "inventory",
                table: "stocks");

            migrationBuilder.DropColumn(
                name: "last_cost",
                schema: "inventory",
                table: "stocks");

            migrationBuilder.DropColumn(
                name: "unit_cost",
                schema: "inventory",
                table: "movements");

            migrationBuilder.DropColumn(
                name: "unit_cost",
                schema: "inventory",
                table: "document_lines");
        }
    }
}
