using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class RemoveTenantDisplayName : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE tenancy.tenants
            SET name = btrim(display_name)
            WHERE display_name IS NOT NULL
              AND btrim(display_name) <> ''
              AND btrim(display_name) <> name;
            """);

        migrationBuilder.DropColumn(
            name: "display_name",
            schema: "tenancy",
            table: "tenants");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "display_name",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(200)",
            maxLength: 200,
            nullable: true);
    }
}
