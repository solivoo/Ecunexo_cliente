using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddSubscriptionAccounts : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameColumn(
            name: "tenant_id",
            schema: "tenancy",
            table: "license_redemptions",
            newName: "subscription_account_id");

        migrationBuilder.CreateTable(
            name: "subscription_accounts",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                grant_id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                department = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                phone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                job_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                password_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                subscription_max_tenants = table.Column<int>(type: "integer", nullable: false),
                enabled_modules = table.Column<string>(type: "jsonb", nullable: true),
                subscription_group_id = table.Column<Guid>(type: "uuid", nullable: false),
                last_login_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                plan_max_users = table.Column<int>(type: "integer", nullable: false),
                plan_max_warehouses = table.Column<int>(type: "integer", nullable: false),
                plan_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_subscription_accounts", x => x.id);
            });

        migrationBuilder.CreateIndex(
            name: "ix_license_redemptions_subscription_account_id",
            schema: "tenancy",
            table: "license_redemptions",
            column: "subscription_account_id");

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_email",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_grant_id",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "grant_id",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_subscription_accounts_subscription_group_id",
            schema: "tenancy",
            table: "subscription_accounts",
            column: "subscription_group_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "subscription_accounts",
            schema: "tenancy");

        migrationBuilder.DropIndex(
            name: "ix_license_redemptions_subscription_account_id",
            schema: "tenancy",
            table: "license_redemptions");

        migrationBuilder.RenameColumn(
            name: "subscription_account_id",
            schema: "tenancy",
            table: "license_redemptions",
            newName: "tenant_id");
    }
}
