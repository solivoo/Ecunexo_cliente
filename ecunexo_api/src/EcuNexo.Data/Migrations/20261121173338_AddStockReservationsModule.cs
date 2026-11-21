using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddStockReservationsModule : Migration
{
    private static readonly string[] TenantCustomerColumns = ["tenant_id", "customer_id"];
    private static readonly string[] TenantReservationNumberColumns = ["tenant_id", "reservation_number"];
    private static readonly string[] TenantStatusColumns = ["tenant_id", "status"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stock_reservations",
                schema: "ecommerce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reservation_number = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    customer_tax_id = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    customer_email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    customer_phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    reserved_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    expires_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    subtotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    tax_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    total_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    paid_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    billing_invoice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    invoice_observation = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    invoiced_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    cancelled_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    cancellation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_reservations", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_reservations_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "repairs",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stock_reservations_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_stock_reservations_warehouses_warehouse_id",
                        column: x => x.warehouse_id,
                        principalSchema: "warehousing",
                        principalTable: "warehouses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stock_reservation_items",
                schema: "ecommerce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_reservation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sku = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    item_name = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    tax_rate = table.Column<decimal>(type: "numeric(7,4)", nullable: false),
                    line_subtotal = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    line_tax = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_reservation_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_reservation_items_stock_reservations_stock_reservatio",
                        column: x => x.stock_reservation_id,
                        principalSchema: "ecommerce",
                        principalTable: "stock_reservations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_reservation_payments",
                schema: "ecommerce",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    stock_reservation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    payment_method = table.Column<int>(type: "integer", nullable: false),
                    reference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    proof_object_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    proof_content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    paid_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_reservation_payments", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_reservation_payments_stock_reservations_stock_reserva",
                        column: x => x.stock_reservation_id,
                        principalSchema: "ecommerce",
                        principalTable: "stock_reservations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservation_items_stock_reservation_id",
                schema: "ecommerce",
                table: "stock_reservation_items",
                column: "stock_reservation_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservation_payments_stock_reservation_id",
                schema: "ecommerce",
                table: "stock_reservation_payments",
                column: "stock_reservation_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_customer_id",
                schema: "ecommerce",
                table: "stock_reservations",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_tenant_id_customer_id",
                schema: "ecommerce",
                table: "stock_reservations",
                columns: TenantCustomerColumns);

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_tenant_id_reservation_number",
                schema: "ecommerce",
                table: "stock_reservations",
                columns: TenantReservationNumberColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_tenant_id_status",
                schema: "ecommerce",
                table: "stock_reservations",
                columns: TenantStatusColumns);

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_warehouse_id",
                schema: "ecommerce",
                table: "stock_reservations",
                column: "warehouse_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stock_reservation_items",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "stock_reservation_payments",
                schema: "ecommerce");

            migrationBuilder.DropTable(
                name: "stock_reservations",
                schema: "ecommerce");
        }
}
