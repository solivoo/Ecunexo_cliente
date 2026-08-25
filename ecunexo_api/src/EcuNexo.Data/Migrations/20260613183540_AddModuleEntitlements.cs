using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddModuleEntitlements : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<IReadOnlyList<ModuleEntitlement>>(
            name: "module_entitlements",
            schema: "tenancy",
            table: "tenants",
            type: "jsonb",
            nullable: true);

        migrationBuilder.AddColumn<IReadOnlyList<ModuleEntitlement>>(
            name: "module_entitlements",
            schema: "tenancy",
            table: "subscription_accounts",
            type: "jsonb",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "module_entitlements",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "module_entitlements",
            schema: "tenancy",
            table: "subscription_accounts");
    }
}
