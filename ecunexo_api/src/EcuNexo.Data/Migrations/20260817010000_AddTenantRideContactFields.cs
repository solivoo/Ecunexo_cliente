using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

[Migration("20260817010000_AddTenantRideContactFields")]
public class AddTenantRideContactFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "contact_email",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(320)",
            maxLength: 320,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "contact_phone",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(30)",
            maxLength: 30,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "ride_thank_you_text",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "contact_email",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "contact_phone",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "ride_thank_you_text",
            schema: "tenancy",
            table: "tenants");
    }
}
