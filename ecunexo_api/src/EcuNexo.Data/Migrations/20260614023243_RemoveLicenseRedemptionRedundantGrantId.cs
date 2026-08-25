using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class RemoveLicenseRedemptionRedundantGrantId : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_license_redemptions_grant_id",
            schema: "tenancy",
            table: "license_redemptions");

        migrationBuilder.DropColumn(
            name: "grant_id",
            schema: "tenancy",
            table: "license_redemptions");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "grant_id",
            schema: "tenancy",
            table: "license_redemptions",
            type: "uuid",
            nullable: false,
            defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

        migrationBuilder.CreateIndex(
            name: "ix_license_redemptions_grant_id",
            schema: "tenancy",
            table: "license_redemptions",
            column: "grant_id",
            unique: true);
    }
}
