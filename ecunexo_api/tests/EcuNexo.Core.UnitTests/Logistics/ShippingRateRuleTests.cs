using EcuNexo.Core.Logistics;

namespace EcuNexo.Core.UnitTests.Logistics;

public class ShippingRateRuleTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidParameters_ShouldSucceed()
    {
        var result = ShippingRateRule.Create(
            Guid.NewGuid(),
            TenantId,
            carrier: "Servientrega",
            zone: "Provincia",
            name: "Servientrega Nacional",
            price: 6.00m,
            minQuantity: 1m,
            maxQuantity: 35m,
            taxRate: 15m,
            estimatedDays: "24-48h");

        result.IsSuccess.Should().BeTrue();
        var rule = result.Value!;
        rule.Carrier.Should().Be("Servientrega");
        rule.Zone.Should().Be("Provincia");
        rule.Name.Should().Be("Servientrega Nacional");
        rule.Price.Should().Be(6.00m);
        rule.MinQuantity.Should().Be(1m);
        rule.MaxQuantity.Should().Be(35m);
        rule.TaxRate.Should().Be(15m);
        rule.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Create_WithInvalidRanges_ShouldFail()
    {
        var result = ShippingRateRule.Create(
            Guid.NewGuid(),
            TenantId,
            carrier: "Cooperativa",
            zone: "Provincia",
            name: "Cooperativa bulto",
            price: 6.00m,
            minQuantity: 36m,
            maxQuantity: 10m); // Max < Min

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("logistics.shipping_rule.max_quantity.range");
    }

    [Fact]
    public void Matches_ShouldRespectQuantityAndZone()
    {
        var rule = ShippingRateRule.Create(
            Guid.NewGuid(),
            TenantId,
            carrier: "Cooperativa",
            zone: "Provincia",
            name: "Cooperativa a partir de 36u",
            price: 6.00m,
            minQuantity: 36m,
            maxQuantity: null).Value!;

        // Menos de 36 unidades -> no califica
        rule.Matches("Provincia", 12m).Should().BeFalse();
        rule.Matches("Provincia", 35m).Should().BeFalse();

        // 36 o más -> califica
        rule.Matches("Provincia", 36m).Should().BeTrue();
        rule.Matches("Provincia", 100m).Should().BeTrue();

        // Otra zona -> no califica
        rule.Matches("Local", 36m).Should().BeFalse();
    }

    [Fact]
    public void Resolver_ShouldSelectCooperativaWhen36UnitsOrMore()
    {
        var localRule = ShippingRateRule.Create(
            Guid.NewGuid(), TenantId, "Local", "Local", "Local Moto", 3.00m, 1m, null).Value!;

        var servientregaProvincia = ShippingRateRule.Create(
            Guid.NewGuid(), TenantId, "Servientrega", "Provincia", "Servientrega Provincia", 6.00m, 1m, 35m).Value!;

        var servientregaGalapagos = ShippingRateRule.Create(
            Guid.NewGuid(), TenantId, "Servientrega", "Galapagos", "Servientrega Galápagos", 13.00m, 1m, 35m).Value!;

        var cooperativaProvincia = ShippingRateRule.Create(
            Guid.NewGuid(), TenantId, "Cooperativa", "Provincia", "Cooperativa a partir de 36u", 6.00m, 36m, null).Value!;

        var rules = new[] { localRule, servientregaProvincia, servientregaGalapagos, cooperativaProvincia };

        // Caso 1: Provincia con 12 unidades (1 docena)
        var options12 = ShippingRateResolver.Resolve(rules, "Provincia", totalQuantity: 12m);
        options12.Should().HaveCount(2);

        var eligible12 = options12.Where(o => o.IsEligible).ToList();
        eligible12.Should().HaveCount(1);
        eligible12[0].Carrier.Should().Be("Servientrega");
        eligible12[0].IsRecommended.Should().BeTrue();

        var ineligible12 = options12.First(o => !o.IsEligible);
        ineligible12.Carrier.Should().Be("Cooperativa");
        ineligible12.UnitsNeeded.Should().Be(24m); // 36 - 12 = 24

        // Caso 2: Provincia con 36 unidades (3 docenas)
        var options36 = ShippingRateResolver.Resolve(rules, "Provincia", totalQuantity: 36m);
        var recommended36 = options36.FirstOrDefault(o => o.IsRecommended);
        recommended36.Should().NotBeNull();
        recommended36!.Carrier.Should().Be("Cooperativa");
        recommended36.Price.Should().Be(6.00m);
        recommended36.TaxAmount.Should().Be(0.90m); // 15% de 6.00
        recommended36.TotalPrice.Should().Be(6.90m);

        // Caso 3: Galápagos con 1 unidad
        var optionsGalapagos = ShippingRateResolver.Resolve(rules, "Galapagos", totalQuantity: 1m);
        optionsGalapagos.Should().HaveCount(1);
        optionsGalapagos[0].Carrier.Should().Be("Servientrega");
        optionsGalapagos[0].Price.Should().Be(13.00m);
    }
}
