using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddCatalogSchema : Migration
{
    private static readonly string[] CategoriesTenantNameIndexColumns = ["tenant_id", "name"];
    private static readonly string[] CategoriesTenantParentIndexColumns = ["tenant_id", "parent_id"];
    private static readonly string[] ItemsTenantSkuIndexColumns = ["tenant_id", "sku"];
    private static readonly string[] ItemsTenantKindNameIndexColumns = ["tenant_id", "kind", "name"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "catalog");

        migrationBuilder.CreateTable(
            name: "categories",
            schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                attribute_schema_json = table.Column<string>(type: "jsonb", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_categories", x => x.id);
                table.ForeignKey(
                    name: "fk_categories_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_categories_categories_parent_id",
                    column: x => x.parent_id,
                    principalSchema: "catalog",
                    principalTable: "categories",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "items",
            schema: "catalog",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                category_id = table.Column<Guid>(type: "uuid", nullable: true),
                kind = table.Column<int>(type: "integer", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                sku = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                base_price = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                custom_attributes_json = table.Column<string>(type: "jsonb", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                deleted_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                deleted_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_items", x => x.id);
                table.ForeignKey(
                    name: "fk_items_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_items_categories_category_id",
                    column: x => x.category_id,
                    principalSchema: "catalog",
                    principalTable: "categories",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_categories_tenant_id_name",
            schema: "catalog",
            table: "categories",
            columns: CategoriesTenantNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.CreateIndex(
            name: "ix_categories_tenant_id_parent_id",
            schema: "catalog",
            table: "categories",
            columns: CategoriesTenantParentIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_items_tenant_id_sku",
            schema: "catalog",
            table: "items",
            columns: ItemsTenantSkuIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL AND sku IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "ix_items_tenant_id_kind_name",
            schema: "catalog",
            table: "items",
            columns: ItemsTenantKindNameIndexColumns);

        migrationBuilder.CreateIndex(
            name: "ix_categories_parent_id",
            schema: "catalog",
            table: "categories",
            column: "parent_id");

        migrationBuilder.CreateIndex(
            name: "ix_items_category_id",
            schema: "catalog",
            table: "items",
            column: "category_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "items",
            schema: "catalog");

        migrationBuilder.DropTable(
            name: "categories",
            schema: "catalog");
    }
}
