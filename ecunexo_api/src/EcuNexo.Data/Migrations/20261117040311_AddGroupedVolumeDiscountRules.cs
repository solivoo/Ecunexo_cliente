using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

    /// <inheritdoc />
    public partial class AddGroupedVolumeDiscountRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "enforce_min_purchase",
                schema: "pricing",
                table: "volume_discount_schemes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "grouping_mode",
                schema: "pricing",
                table: "volume_discount_schemes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "min_group_quantity",
                schema: "pricing",
                table: "volume_discount_schemes",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "priority",
                schema: "pricing",
                table: "volume_discount_schemes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "volume_discount_targets",
                schema: "pricing",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    volume_discount_scheme_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_type = table.Column<int>(type: "integer", nullable: false),
                    target_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    is_exclusion = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_volume_discount_targets", x => x.id);
                    table.ForeignKey(
                        name: "fk_volume_discount_targets_volume_discount_schemes_volume_disc",
                        column: x => x.volume_discount_scheme_id,
                        principalSchema: "pricing",
                        principalTable: "volume_discount_schemes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_volume_discount_targets_scheme_id",
                schema: "pricing",
                table: "volume_discount_targets",
                column: "volume_discount_scheme_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "volume_discount_targets",
                schema: "pricing");

            migrationBuilder.DropColumn(
                name: "enforce_min_purchase",
                schema: "pricing",
                table: "volume_discount_schemes");

            migrationBuilder.DropColumn(
                name: "grouping_mode",
                schema: "pricing",
                table: "volume_discount_schemes");

            migrationBuilder.DropColumn(
                name: "min_group_quantity",
                schema: "pricing",
                table: "volume_discount_schemes");

            migrationBuilder.DropColumn(
                name: "priority",
                schema: "pricing",
                table: "volume_discount_schemes");
        }
    }
