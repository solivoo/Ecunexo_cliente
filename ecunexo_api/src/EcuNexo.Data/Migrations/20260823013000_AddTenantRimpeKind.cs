using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
[DbContext(typeof(EcuNexoDbContext))]
[Migration("20260823013000_AddTenantRimpeKind")]
public class AddTenantRimpeKind : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "rimpe_kind",
            schema: "tenancy",
            table: "tenants",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<bool>(
            name: "prefer_electronic_invoice",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.Sql(
            """
            UPDATE tenancy.tenants
            SET rimpe_kind = 2
            WHERE is_rimpe = TRUE;
            """);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "prefer_electronic_invoice",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "rimpe_kind",
            schema: "tenancy",
            table: "tenants");
    }
}
