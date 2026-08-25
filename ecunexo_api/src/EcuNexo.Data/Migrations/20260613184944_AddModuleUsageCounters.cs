using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddModuleUsageCounters : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "module_usage_counters",
            schema: "tenancy",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                module_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                limit_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                current_value = table.Column<int>(type: "integer", nullable: false),
                period_start_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                period_end_utc = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamptz", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_module_usage_counters", x => x.id);
            });

        var columns = new[] { "tenant_id", "module_code", "limit_key" };
        migrationBuilder.CreateIndex(
            name: "ix_module_usage_counters_tenant_module_limit",
            schema: "tenancy",
            table: "module_usage_counters",
            columns: columns,
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "module_usage_counters",
            schema: "tenancy");
    }
}
