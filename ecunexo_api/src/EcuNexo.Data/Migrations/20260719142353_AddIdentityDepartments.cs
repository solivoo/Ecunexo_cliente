using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddIdentityDepartments : Migration
{
    private static readonly string[] DepartmentsTenantNameIndexColumns = ["tenant_id", "name"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "department_id",
            schema: "identity",
            table: "users",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "departments",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                table.PrimaryKey("pk_departments", x => x.id);
                table.ForeignKey(
                    name: "fk_departments_tenants_tenant_id",
                    column: x => x.tenant_id,
                    principalSchema: "tenancy",
                    principalTable: "tenants",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_users_department_id",
            schema: "identity",
            table: "users",
            column: "department_id");

        migrationBuilder.CreateIndex(
            name: "ix_departments_tenant_id_name",
            schema: "identity",
            table: "departments",
            columns: DepartmentsTenantNameIndexColumns,
            unique: true,
            filter: "\"deleted_at\" IS NULL");

        migrationBuilder.AddForeignKey(
            name: "fk_users_departments_department_id",
            schema: "identity",
            table: "users",
            column: "department_id",
            principalSchema: "identity",
            principalTable: "departments",
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_users_departments_department_id",
            schema: "identity",
            table: "users");

        migrationBuilder.DropTable(
            name: "departments",
            schema: "identity");

        migrationBuilder.DropIndex(
            name: "ix_users_department_id",
            schema: "identity",
            table: "users");

        migrationBuilder.DropColumn(
            name: "department_id",
            schema: "identity",
            table: "users");
    }
}
