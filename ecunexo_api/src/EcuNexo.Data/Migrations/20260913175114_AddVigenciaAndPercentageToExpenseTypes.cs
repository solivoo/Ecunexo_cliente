using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddVigenciaAndPercentageToExpenseTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "retention_percentage",
                schema: "purchases",
                table: "expense_types",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "valid_from",
                schema: "purchases",
                table: "expense_types",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "valid_until",
                schema: "purchases",
                table: "expense_types",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "retention_percentage",
                schema: "purchases",
                table: "expense_types");

            migrationBuilder.DropColumn(
                name: "valid_from",
                schema: "purchases",
                table: "expense_types");

            migrationBuilder.DropColumn(
                name: "valid_until",
                schema: "purchases",
                table: "expense_types");
        }
    }
