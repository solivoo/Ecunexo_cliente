using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddTenantBrandLogos : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "logo_dark_id",
            schema: "tenancy",
            table: "tenants",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "logo_light_id",
            schema: "tenancy",
            table: "tenants",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<bool>(
            name: "prefer_wordmark",
            schema: "tenancy",
            table: "tenants",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateTable(
            name: "tenant_brand_logos",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                original_file_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                extension = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                content_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                byte_size = table.Column<int>(type: "integer", nullable: false),
                image_bytes = table.Column<byte[]>(type: "bytea", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_tenant_brand_logos", x => x.id);
                table.ForeignKey(
                    name: "fk_tenant_brand_logos_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "ix_tenant_brand_logos_tenant_id",
            schema: "tenancy",
            table: "tenant_brand_logos",
            column: "tenant_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "tenant_brand_logos",
            schema: "tenancy");

        migrationBuilder.DropColumn(
            name: "logo_dark_id",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "logo_light_id",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "prefer_wordmark",
            schema: "tenancy",
            table: "tenants");
    }
}
