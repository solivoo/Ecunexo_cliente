using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddWarehousingAndInventory : Migration
{
        private static readonly string[] DocumentsTenantStatusCreatedIndexColumns = ["tenant_id", "status", "created_at"];
        private static readonly string[] MovementsTenantItemWarehouseOccurredIndexColumns =
            ["tenant_id", "catalog_item_id", "warehouse_id", "occurred_at"];
        private static readonly string[] MovementsTenantOccurredIndexColumns = ["tenant_id", "occurred_at"];
        private static readonly string[] StocksTenantItemWarehouseIndexColumns = ["tenant_id", "catalog_item_id", "warehouse_id"];
        private static readonly string[] StocksTenantWarehouseIndexColumns = ["tenant_id", "warehouse_id"];
        private static readonly string[] WarehousesTenantCodeIndexColumns = ["tenant_id", "code"];
        private static readonly string[] WarehousesTenantMainIndexColumns = ["tenant_id", "is_main"];
        private static readonly string[] WarehousesTenantNameIndexColumns = ["tenant_id", "name"];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "inventory");

            migrationBuilder.EnsureSchema(
                name: "warehousing");

            migrationBuilder.CreateTable(
                name: "warehouses",
                schema: "warehousing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    address_json = table.Column<string>(type: "jsonb", nullable: false),
                    is_main = table.Column<bool>(type: "boolean", nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    system_role = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    deleted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_warehouses", x => x.id);
                    table.ForeignKey(
                        name: "fk_warehouses_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "documents",
                schema: "inventory",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_documents", x => x.id);
                    table.ForeignKey(
                        name: "fk_documents_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_documents_warehouses_warehouse_id",
                        column: x => x.warehouse_id,
                        principalSchema: "warehousing",
                        principalTable: "warehouses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stocks",
                schema: "inventory",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stocks", x => x.id);
                    table.ForeignKey(
                        name: "fk_stocks_catalog_items_catalog_item_id",
                        column: x => x.catalog_item_id,
                        principalSchema: "catalog",
                        principalTable: "items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stocks_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_stocks_warehouses_warehouse_id",
                        column: x => x.warehouse_id,
                        principalSchema: "warehousing",
                        principalTable: "warehouses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "document_lines",
                schema: "inventory",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_document_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_document_lines_documents_document_id",
                        column: x => x.document_id,
                        principalSchema: "inventory",
                        principalTable: "documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_document_lines_items_catalog_item_id",
                        column: x => x.catalog_item_id,
                        principalSchema: "catalog",
                        principalTable: "items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "movements",
                schema: "inventory",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    warehouse_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_id = table.Column<Guid>(type: "uuid", nullable: false),
                    direction = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_movements", x => x.id);
                    table.ForeignKey(
                        name: "fk_movements_documents_document_id",
                        column: x => x.document_id,
                        principalSchema: "inventory",
                        principalTable: "documents",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_movements_items_catalog_item_id",
                        column: x => x.catalog_item_id,
                        principalSchema: "catalog",
                        principalTable: "items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_movements_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_movements_warehouses_warehouse_id",
                        column: x => x.warehouse_id,
                        principalSchema: "warehousing",
                        principalTable: "warehouses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_document_lines_catalog_item_id",
                schema: "inventory",
                table: "document_lines",
                column: "catalog_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_document_lines_document_id",
                schema: "inventory",
                table: "document_lines",
                column: "document_id");

            migrationBuilder.CreateIndex(
                name: "ix_documents_tenant_id_status_created_at",
                schema: "inventory",
                table: "documents",
                columns: DocumentsTenantStatusCreatedIndexColumns);

            migrationBuilder.CreateIndex(
                name: "ix_documents_warehouse_id",
                schema: "inventory",
                table: "documents",
                column: "warehouse_id");

            migrationBuilder.CreateIndex(
                name: "ix_movements_catalog_item_id",
                schema: "inventory",
                table: "movements",
                column: "catalog_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_movements_document_id",
                schema: "inventory",
                table: "movements",
                column: "document_id");

            migrationBuilder.CreateIndex(
                name: "ix_movements_tenant_id_catalog_item_id_warehouse_id_occurred_at",
                schema: "inventory",
                table: "movements",
                columns: MovementsTenantItemWarehouseOccurredIndexColumns);

            migrationBuilder.CreateIndex(
                name: "ix_movements_tenant_id_occurred_at",
                schema: "inventory",
                table: "movements",
                columns: MovementsTenantOccurredIndexColumns);

            migrationBuilder.CreateIndex(
                name: "ix_movements_warehouse_id",
                schema: "inventory",
                table: "movements",
                column: "warehouse_id");

            migrationBuilder.CreateIndex(
                name: "ix_stocks_catalog_item_id",
                schema: "inventory",
                table: "stocks",
                column: "catalog_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_stocks_tenant_id_catalog_item_id_warehouse_id",
                schema: "inventory",
                table: "stocks",
                columns: StocksTenantItemWarehouseIndexColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stocks_tenant_id_warehouse_id",
                schema: "inventory",
                table: "stocks",
                columns: StocksTenantWarehouseIndexColumns);

            migrationBuilder.CreateIndex(
                name: "ix_stocks_warehouse_id",
                schema: "inventory",
                table: "stocks",
                column: "warehouse_id");

            migrationBuilder.CreateIndex(
                name: "ix_warehouses_tenant_id_code",
                schema: "warehousing",
                table: "warehouses",
                columns: WarehousesTenantCodeIndexColumns,
                unique: true,
                filter: "\"deleted_at\" IS NULL AND code IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_warehouses_tenant_id_is_main",
                schema: "warehousing",
                table: "warehouses",
                columns: WarehousesTenantMainIndexColumns,
                unique: true,
                filter: "\"deleted_at\" IS NULL AND is_main = TRUE");

            migrationBuilder.CreateIndex(
                name: "ix_warehouses_tenant_id_name",
                schema: "warehousing",
                table: "warehouses",
                columns: WarehousesTenantNameIndexColumns,
                unique: true,
                filter: "\"deleted_at\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "document_lines",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "movements",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "stocks",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "documents",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "warehouses",
                schema: "warehousing");
        }
}
