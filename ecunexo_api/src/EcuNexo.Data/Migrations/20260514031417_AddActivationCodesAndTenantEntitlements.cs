using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddActivationCodesAndTenantEntitlements : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "enabled_modules",
            schema: "tenancy",
            table: "tenants",
            type: "jsonb",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "subscription_max_tenants",
            schema: "tenancy",
            table: "tenants",
            type: "integer",
            nullable: false,
            defaultValue: 1);

        migrationBuilder.CreateTable(
            name: "activation_codes",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                code_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                plan_label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                max_tenants = table.Column<int>(type: "integer", nullable: false),
                max_users = table.Column<int>(type: "integer", nullable: false),
                max_warehouses = table.Column<int>(type: "integer", nullable: false),
                enabled_module_codes = table.Column<string>(type: "jsonb", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                provisioning_slots_remaining = table.Column<int>(type: "integer", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                consumed_at_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                consumed_by_tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_activation_codes", x => x.id);
            });

        migrationBuilder.CreateIndex(
            name: "ix_activation_codes_code_hash",
            schema: "tenancy",
            table: "activation_codes",
            column: "code_hash",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "activation_codes",
            schema: "tenancy");

        migrationBuilder.DropColumn(
            name: "enabled_modules",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "subscription_max_tenants",
            schema: "tenancy",
            table: "tenants");
    }
}
