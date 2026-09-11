using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddDispatchExitType : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "exit_type",
            schema: "repairs",
            table: "dispatches",
            type: "integer",
            nullable: false,
            defaultValue: 0);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "exit_type",
            schema: "repairs",
            table: "dispatches");
    }
}
