using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddShippingMethodCoverageScope : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "coverage_scope",
            schema: "logistics",
            table: "shipping_methods",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "coverage_scope",
            schema: "logistics",
            table: "shipping_methods");
    }
}
