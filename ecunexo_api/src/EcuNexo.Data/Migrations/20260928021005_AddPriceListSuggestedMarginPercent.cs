using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceListSuggestedMarginPercent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "suggested_margin_percent",
                schema: "pricing",
                table: "price_lists",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "suggested_margin_percent",
                schema: "pricing",
                table: "price_lists");
        }
    }
}
