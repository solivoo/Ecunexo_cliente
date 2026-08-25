using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddInventoryTransferFields : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "destination_warehouse_id",
            schema: "inventory",
            table: "documents",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "shipped_at",
            schema: "inventory",
            table: "documents",
            type: "timestamptz",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "shipped_by",
            schema: "inventory",
            table: "documents",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "ix_documents_destination_warehouse_id",
            schema: "inventory",
            table: "documents",
            column: "destination_warehouse_id");

        migrationBuilder.AddForeignKey(
            name: "fk_documents_warehouses_destination_warehouse_id",
            schema: "inventory",
            table: "documents",
            column: "destination_warehouse_id",
            principalSchema: "warehousing",
            principalTable: "warehouses",
            principalColumn: "id",
            onDelete: ReferentialAction.Restrict);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_documents_warehouses_destination_warehouse_id",
            schema: "inventory",
            table: "documents");

        migrationBuilder.DropIndex(
            name: "ix_documents_destination_warehouse_id",
            schema: "inventory",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "destination_warehouse_id",
            schema: "inventory",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "shipped_at",
            schema: "inventory",
            table: "documents");

        migrationBuilder.DropColumn(
            name: "shipped_by",
            schema: "inventory",
            table: "documents");
    }
}
