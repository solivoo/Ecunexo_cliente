using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddEcuadorGeoAndCantonShippingRates : Migration
{
    private static readonly string[] TenantCantonMethodIndexColumns = ["tenant_id", "canton_id", "shipping_method_id"];
    private static readonly string[] CantonProvinceNameIndexColumns = ["province_id", "name"];
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ecuador_provinces",
                schema: "logistics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    region = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ecuador_provinces", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ecuador_cantons",
                schema: "logistics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    province_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_provincial_capital = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ecuador_cantons", x => x.id);
                    table.ForeignKey(
                        name: "fk_ecuador_cantons_ecuador_provinces_province_id",
                        column: x => x.province_id,
                        principalSchema: "logistics",
                        principalTable: "ecuador_provinces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "canton_shipping_rates",
                schema: "logistics",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    canton_id = table.Column<Guid>(type: "uuid", nullable: false),
                    shipping_method_id = table.Column<Guid>(type: "uuid", nullable: true),
                    base_price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    base_weight_kg = table.Column<decimal>(type: "numeric(12,4)", nullable: false, defaultValue: 2m),
                    additional_kg_price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    volumetric_divisor = table.Column<decimal>(type: "numeric(10,2)", nullable: false, defaultValue: 6000m),
                    round_up_extra_kg = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    free_shipping_min_amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    tax_rate = table.Column<decimal>(type: "numeric(5,2)", nullable: false, defaultValue: 15m),
                    estimated_days = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_canton_shipping_rates", x => x.id);
                    table.ForeignKey(
                        name: "fk_canton_shipping_rates_ecuador_cantons_canton_id",
                        column: x => x.canton_id,
                        principalSchema: "logistics",
                        principalTable: "ecuador_cantons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_canton_shipping_rates_shipping_methods_shipping_method_id",
                        column: x => x.shipping_method_id,
                        principalSchema: "logistics",
                        principalTable: "shipping_methods",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_canton_shipping_rates_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_canton_shipping_rates_canton_id",
                schema: "logistics",
                table: "canton_shipping_rates",
                column: "canton_id");

            migrationBuilder.CreateIndex(
                name: "ix_canton_shipping_rates_shipping_method_id",
                schema: "logistics",
                table: "canton_shipping_rates",
                column: "shipping_method_id");

            migrationBuilder.CreateIndex(
                name: "ix_canton_shipping_rates_tenant_canton_method",
                schema: "logistics",
                table: "canton_shipping_rates",
                columns: TenantCantonMethodIndexColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ecuador_cantons_code",
                schema: "logistics",
                table: "ecuador_cantons",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ecuador_cantons_province_name",
                schema: "logistics",
                table: "ecuador_cantons",
                columns: CantonProvinceNameIndexColumns);

            migrationBuilder.CreateIndex(
                name: "ix_ecuador_provinces_code",
                schema: "logistics",
                table: "ecuador_provinces",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ecuador_provinces_name",
                schema: "logistics",
                table: "ecuador_provinces",
                column: "name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "canton_shipping_rates",
                schema: "logistics");

            migrationBuilder.DropTable(
                name: "ecuador_cantons",
                schema: "logistics");

            migrationBuilder.DropTable(
                name: "ecuador_provinces",
                schema: "logistics");
        }
    }
