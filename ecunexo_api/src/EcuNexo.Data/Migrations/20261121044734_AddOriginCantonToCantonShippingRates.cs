using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EcuNexo.Data.Migrations;

/// <inheritdoc />
public partial class AddOriginCantonToCantonShippingRates : Migration
{
    private static readonly string[] OriginCantonIndexColumns =
        ["tenant_id", "origin_canton_id", "canton_id", "shipping_method_id"];

    private static readonly string[] LegacyCantonIndexColumns =
        ["tenant_id", "canton_id", "shipping_method_id"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ix_canton_shipping_rates_tenant_canton_method",
            schema: "logistics",
            table: "canton_shipping_rates");

        migrationBuilder.AddColumn<Guid>(
            name: "origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "ix_canton_shipping_rates_origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates",
            column: "origin_canton_id");

        migrationBuilder.CreateIndex(
            name: "ix_canton_shipping_rates_tenant_origin_canton_method",
            schema: "logistics",
            table: "canton_shipping_rates",
            columns: OriginCantonIndexColumns,
            unique: true);

        migrationBuilder.AddForeignKey(
            name: "fk_canton_shipping_rates_ecuador_cantons_origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates",
            column: "origin_canton_id",
            principalSchema: "logistics",
            principalTable: "ecuador_cantons",
            principalColumn: "id",
            onDelete: ReferentialAction.SetNull);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "fk_canton_shipping_rates_ecuador_cantons_origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates");

        migrationBuilder.DropIndex(
            name: "ix_canton_shipping_rates_origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates");

        migrationBuilder.DropIndex(
            name: "ix_canton_shipping_rates_tenant_origin_canton_method",
            schema: "logistics",
            table: "canton_shipping_rates");

        migrationBuilder.DropColumn(
            name: "origin_canton_id",
            schema: "logistics",
            table: "canton_shipping_rates");

        migrationBuilder.CreateIndex(
            name: "ix_canton_shipping_rates_tenant_canton_method",
            schema: "logistics",
            table: "canton_shipping_rates",
            columns: LegacyCantonIndexColumns,
            unique: true);
    }
}
