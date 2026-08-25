using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddPlatformSysSettings : Migration
{
    private static readonly string[] SysSettingsCodeScopeScopeIdIndexColumns = ["code", "scope", "scope_id"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(
            name: "platform");

        migrationBuilder.CreateTable(
            name: "sys_settings",
            schema: "platform",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                value = table.Column<string>(type: "jsonb", nullable: false),
                scope = table.Column<int>(type: "integer", nullable: false),
                scope_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_sys_settings", x => x.id);
            });

        migrationBuilder.CreateIndex(
            name: "ix_sys_settings_code_scope_scope_id",
            schema: "platform",
            table: "sys_settings",
            columns: SysSettingsCodeScopeScopeIdIndexColumns,
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "sys_settings",
            schema: "platform");
    }
}
