using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable IDE0005
#pragma warning disable IDE0161
#pragma warning disable CA1861


namespace EcuNexo.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSystemDefaultAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los atributos base dejan de existir: se eliminan de todos los tenants.
            // Los ítems conservan los valores en su JSON aunque la clave quede sin atributo.
            migrationBuilder.Sql(
                "DELETE FROM catalog.variant_dimension_templates WHERE is_system_default = true;");

            migrationBuilder.DropColumn(
                name: "is_system_default",
                schema: "catalog",
                table: "variant_dimension_templates");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_system_default",
                schema: "catalog",
                table: "variant_dimension_templates",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
