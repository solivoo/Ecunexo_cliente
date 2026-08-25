using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddInvoiceStockEgress : Migration
{
    private static readonly string[] TenantBillingInvoiceIndexColumns =
    [
        "tenant_id",
        "billing_invoice_id",
    ];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "invoice_stock_egresses",
            schema: "inventory",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                billing_invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                inventory_document_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_invoice_stock_egresses", x => x.id);
                table.ForeignKey(
                    name: "fk_invoice_stock_egresses_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_invoice_stock_egresses_tenant_id_billing_invoice_id",
            schema: "inventory",
            table: "invoice_stock_egresses",
            columns: TenantBillingInvoiceIndexColumns,
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "invoice_stock_egresses",
            schema: "inventory");
    }
}
