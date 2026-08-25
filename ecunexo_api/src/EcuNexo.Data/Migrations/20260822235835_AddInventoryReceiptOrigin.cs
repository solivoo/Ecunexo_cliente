using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddInventoryReceiptOrigin : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "receipt_origin",
            schema: "inventory",
            table: "documents",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "source_document_number",
            schema: "inventory",
            table: "documents",
            type: "character varying(20)",
            maxLength: 20,
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "receipt_origin",
            schema: "inventory",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "source_document_number",
            schema: "inventory",
            table: "documents");
    }
}
