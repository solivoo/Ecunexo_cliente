using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddCatalogItemResolvedThumbnails : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "resolved_medium_url",
            schema: "catalog",
            table: "items",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "resolved_thumb_url",
            schema: "catalog",
            table: "items",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "resolved_medium_url",
            schema: "catalog",
            table: "items");

        migrationBuilder.DropColumn(
            name: "resolved_thumb_url",
            schema: "catalog",
            table: "items");
    }
}
