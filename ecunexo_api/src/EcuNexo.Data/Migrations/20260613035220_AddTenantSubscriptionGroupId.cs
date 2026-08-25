using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddTenantSubscriptionGroupId : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "subscription_group_id",
            schema: "tenancy",
            table: "tenants",
            type: "uuid",
            nullable: true);

        migrationBuilder.Sql(
            """
            UPDATE tenancy.tenants
            SET subscription_group_id = id
            WHERE subscription_group_id IS NULL;
            """);

        migrationBuilder.AlterColumn<Guid>(
            name: "subscription_group_id",
            schema: "tenancy",
            table: "tenants",
            type: "uuid",
            nullable: false,
            oldClrType: typeof(Guid),
            oldType: "uuid",
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "ix_tenants_subscription_group_id",
            schema: "tenancy",
            table: "tenants",
            column: "subscription_group_id");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_tenants_subscription_group_id",
            schema: "tenancy",
            table: "tenants");

        migrationBuilder.DropColumn(
            name: "subscription_group_id",
            schema: "tenancy",
            table: "tenants");
    }
}
