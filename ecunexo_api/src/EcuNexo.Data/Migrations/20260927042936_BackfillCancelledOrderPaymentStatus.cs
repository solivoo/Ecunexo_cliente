using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class BackfillCancelledOrderPaymentStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE ecommerce.orders SET payment_status = 5 WHERE status = 5 AND payment_status IN (0, 1);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE ecommerce.orders SET payment_status = 0 WHERE status = 5 AND payment_status = 5;");
        }
    }
}
