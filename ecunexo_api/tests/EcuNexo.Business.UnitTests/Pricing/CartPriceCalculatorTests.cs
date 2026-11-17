using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class CartPriceCalculatorTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();

    [Fact(DisplayName = "5 pares surtidos de calcetines en paquete suman exactamente $15.00")]
    public void Calculate_FiveAssortedSocks_PackagePriceEquals15()
    {
        var categoryId = Guid.CreateVersion7();
        var rule = CreateSocksPackageRule(categoryId, enforceMin: false);

        var lines = new[]
        {
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 2m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 2m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 1m),
        };

        var result = CartPriceCalculator.Calculate(lines, [rule]);

        result.IsSuccess.Should().BeTrue();
        result.Value!.NetPrice.Should().Be(15.00m);
        result.Value.FinalPrice.Should().Be(15.00m);
    }

    [Fact(DisplayName = "12 pares surtidos en paquete ($34) prorratean al centavo sin perder $0.04")]
    public void Calculate_TwelveAssortedSocks_PackagePriceEquals34Exact()
    {
        var categoryId = Guid.CreateVersion7();
        var rule = CreateSocksPackageRule(categoryId, enforceMin: false);

        var lines = new[]
        {
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 4m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 5m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 3m),
        };

        var result = CartPriceCalculator.Calculate(lines, [rule]);

        result.IsSuccess.Should().BeTrue();
        result.Value!.NetPrice.Should().Be(34.00m);
        result.Value.Lines.Sum(l => l.NetPrice).Should().Be(34.00m);
    }

    [Fact(DisplayName = "Exclusión en categoría deja el ítem excluido a tarifa base y agrupa los demás")]
    public void Calculate_CategoryWithExclusion_ExcludesItemFromPackage()
    {
        var categoryId = Guid.CreateVersion7();
        var excludedSkuId = Guid.CreateVersion7();
        var rule = CreateSocksPackageRule(categoryId, enforceMin: false);
        rule.AddTarget(Guid.CreateVersion7(), VolumeRuleTargetType.Product, excludedSkuId.ToString(), isExclusion: true);

        var lines = new[]
        {
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 3m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 2m),
            Line(excludedSkuId, null, categoryId, 6.00m, 1m),
        };

        var result = CartPriceCalculator.Calculate(lines, [rule]);

        result.IsSuccess.Should().BeTrue();
        result.Value!.NetPrice.Should().Be(21.00m); // 15.00 (5 pares paquete) + 6.00 (excluido)
    }

    [Fact(DisplayName = "Mínimo obligatorio en grupo rechaza compra bajo 5 unidades")]
    public void Calculate_EnforceMinPurchaseBelowMin_ReturnsValidationFailure()
    {
        var categoryId = Guid.CreateVersion7();
        var rule = CreateSocksPackageRule(categoryId, enforceMin: true);

        var lines = new[]
        {
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 2m),
            Line(Guid.CreateVersion7(), null, categoryId, 4.00m, 2m),
        };

        var result = CartPriceCalculator.Calculate(lines, [rule]);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.group_min_quantity");
    }

    [Fact(DisplayName = "Agrupación PerMatrix suma variantes de la misma matriz")]
    public void Calculate_PerMatrixGrouping_SumsVariantsOfSameParent()
    {
        var matrixId = Guid.CreateVersion7();
        var rule = VolumeDiscountScheme.Create(
            Guid.CreateVersion7(),
            TenantId,
            "Camisas por docena",
            null,
            VolumeDiscountSchemeType.FixedPrice,
            groupingMode: VolumeGroupingMode.PerMatrix,
            minGroupQuantity: 12m,
            enforceMinPurchase: true,
            priority: 10).Value!;

        rule.AddTarget(Guid.CreateVersion7(), VolumeRuleTargetType.Matrix, matrixId.ToString());
        rule.AddTier(Guid.CreateVersion7(), 12m, null, 10.00m);

        var lines = new[]
        {
            Line(Guid.CreateVersion7(), matrixId, null, 15.00m, 6m),
            Line(Guid.CreateVersion7(), matrixId, null, 15.00m, 6m),
        };

        var result = CartPriceCalculator.Calculate(lines, [rule]);

        result.IsSuccess.Should().BeTrue();
        result.Value!.NetPrice.Should().Be(120.00m);
    }

    private static VolumeDiscountScheme CreateSocksPackageRule(Guid categoryId, bool enforceMin)
    {
        var rule = VolumeDiscountScheme.Create(
            Guid.CreateVersion7(),
            TenantId,
            "Calcetines por paquete",
            null,
            VolumeDiscountSchemeType.PackagePrice,
            groupingMode: VolumeGroupingMode.PerGroup,
            minGroupQuantity: 5m,
            enforceMinPurchase: enforceMin,
            priority: 10).Value!;

        rule.AddTarget(Guid.CreateVersion7(), VolumeRuleTargetType.Category, categoryId.ToString());
        rule.AddTier(Guid.CreateVersion7(), 5m, 11m, 15.00m);
        rule.AddTier(Guid.CreateVersion7(), 12m, null, 34.00m);
        return rule;
    }

    private static CartLineInput Line(
        Guid catalogItemId,
        Guid? parentId,
        Guid? categoryId,
        decimal listPrice,
        decimal quantity) =>
        new(
            Guid.CreateVersion7(),
            catalogItemId,
            parentId,
            categoryId,
            listPrice,
            quantity,
            [],
            null,
            [],
            0m,
            PricesIncludeTax: true);
}
