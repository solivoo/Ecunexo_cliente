using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddMenuCatalog : Migration
{
    private static readonly string[] MenuItemsContextModuleSortIndexColumns = ["context", "module_code", "sort_order"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "platform");

        migrationBuilder.CreateTable(
            name: "menu_items",
            schema: "platform",
            columns: table => new
            {
                id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                parent_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                label = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                icon = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                route = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                sort_order = table.Column<int>(type: "integer", nullable: false),
                context = table.Column<int>(type: "integer", nullable: false),
                module_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                position = table.Column<int>(type: "integer", nullable: false),
                required_permissions = table.Column<string>(type: "jsonb", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                is_placeholder = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_menu_items", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "product_modules",
            schema: "platform",
            columns: table => new
            {
                code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                display_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_product_modules", x => x.code);
            });

        migrationBuilder.CreateIndex(
            name: "ix_menu_items_context_module_code_sort_order",
            schema: "platform",
            table: "menu_items",
            columns: MenuItemsContextModuleSortIndexColumns);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "menu_items",
            schema: "platform");

        migrationBuilder.DropTable(
            name: "product_modules",
            schema: "platform");
    }
}
