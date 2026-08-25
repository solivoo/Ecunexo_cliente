using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddSaaSUiAndDirectoryColumns : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "job_title",
            schema: "identity",
            table: "users",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "last_login_at",
            schema: "identity",
            table: "users",
            type: "timestamptz",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "phone",
            schema: "identity",
            table: "users",
            type: "character varying(40)",
            maxLength: 40,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "display_name",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "locale",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(16)",
            maxLength: 16,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "logo_url",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "primary_color_hex",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(9)",
            maxLength: 9,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "time_zone_id",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "description",
            schema: "identity",
            table: "roles",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "is_system",
            schema: "identity",
            table: "roles",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "display_name",
            schema: "identity",
            table: "permissions",
            type: "character varying(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "module",
            schema: "identity",
            table: "permissions",
            type: "character varying(80)",
            maxLength: 80,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "sort_order",
            schema: "identity",
            table: "permissions",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "job_title",
            schema: "identity",
            table: "users");

        migrationBuilder.DropColumn(
            name: "last_login_at",
            schema: "identity",
            table: "users");

        migrationBuilder.DropColumn(
            name: "phone",
            schema: "identity",
            table: "users");

        migrationBuilder.DropColumn(
            name: "display_name",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "locale",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "logo_url",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "primary_color_hex",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "time_zone_id",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "description",
            schema: "identity",
            table: "roles");

        migrationBuilder.DropColumn(
            name: "is_system",
            schema: "identity",
            table: "roles");

        migrationBuilder.DropColumn(
            name: "display_name",
            schema: "identity",
            table: "permissions");

        migrationBuilder.DropColumn(
            name: "module",
            schema: "identity",
            table: "permissions");

        migrationBuilder.DropColumn(
            name: "sort_order",
            schema: "identity",
            table: "permissions");
    }
}
