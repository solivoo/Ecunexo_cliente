#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVolumeDiscountSchemes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "volume_discount_scheme_id",
                schema: "pricing",
                table: "product_prices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "volume_discount_schemes",
                schema: "pricing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    type = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_volume_discount_schemes", x => x.id);
                    table.ForeignKey(
                        name: "fk_volume_discount_schemes_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "tenancy",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "volume_discount_tiers",
                schema: "pricing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    scheme_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity_from = table.Column<decimal>(type: "numeric(18,4)", nullable: false),
                    quantity_to = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    value = table.Column<decimal>(type: "numeric(18,6)", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_volume_discount_tiers", x => x.id);
                    table.ForeignKey(
                        name: "fk_volume_discount_tiers_volume_discount_schemes_scheme_id",
                        column: x => x.scheme_id,
                        principalSchema: "pricing",
                        principalTable: "volume_discount_schemes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_product_prices_volume_discount_scheme_id",
                schema: "pricing",
                table: "product_prices",
                column: "volume_discount_scheme_id");

            migrationBuilder.CreateIndex(
                name: "ix_volume_discount_schemes_tenant_name",
                schema: "pricing",
                table: "volume_discount_schemes",
                columns: new[] { "tenant_id", "name" });

            migrationBuilder.CreateIndex(
                name: "ux_volume_discount_tiers_scheme_from",
                schema: "pricing",
                table: "volume_discount_tiers",
                columns: new[] { "scheme_id", "quantity_from" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_product_prices_volume_discount_schemes_volume_discount_sche",
                schema: "pricing",
                table: "product_prices",
                column: "volume_discount_scheme_id",
                principalSchema: "pricing",
                principalTable: "volume_discount_schemes",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_product_prices_volume_discount_schemes_volume_discount_sche",
                schema: "pricing",
                table: "product_prices");

            migrationBuilder.DropTable(
                name: "volume_discount_tiers",
                schema: "pricing");

            migrationBuilder.DropTable(
                name: "volume_discount_schemes",
                schema: "pricing");

            migrationBuilder.DropIndex(
                name: "ix_product_prices_volume_discount_scheme_id",
                schema: "pricing",
                table: "product_prices");

            migrationBuilder.DropColumn(
                name: "volume_discount_scheme_id",
                schema: "pricing",
                table: "product_prices");
        }
    }
}
