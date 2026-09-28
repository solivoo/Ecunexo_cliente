using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerPriceList : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "price_list_id",
                schema: "repairs",
                table: "customers",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "price_list_id",
                schema: "repairs",
                table: "customers");
        }
    }
}
