using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddTenantSriLegalFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "accounting_required",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "address",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(500)",
            maxLength: 500,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "city",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(120)",
            maxLength: 120,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "establishment_code",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "is_exporter",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "is_large_taxpayer",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "is_rimpe",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "is_special_taxpayer",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "is_withholding_agent",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<string>(
            name: "legal_name",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(300)",
            maxLength: 300,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "tax_id",
            schema: "tenancy",
            table: "tenants",
            type: "character varying(13)",
            maxLength: 13,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "ix_tenants_tax_id",
            schema: "tenancy",
            table: "tenants",
            column: "tax_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_tenants_tax_id",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "accounting_required",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "address",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "city",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "establishment_code",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "is_exporter",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "is_large_taxpayer",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "is_rimpe",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "is_special_taxpayer",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "is_withholding_agent",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "legal_name",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "tax_id",
            schema: "tenancy",
            table: "tenants");
    }
}
