using EcuNexo.Core.Pricing;

namespace EcuNexo.Core.UnitTests.Pricing;

public sealed class PriceCalculatorTests
{
    private static readonly IReadOnlyList<QuantityTier> NoTiers = [];
    private static readonly IReadOnlyList<Promotion> NoPromotions = [];

    [Fact(DisplayName = "Precio de lista sin escala ni promoción suma el impuesto")]
    public void Calculate_WithoutTierOrPromotion_AddsTax()
    {
        var result = PriceCalculator.Calculate(100m, 2m, NoTiers, NoPromotions, 0.15m, pricesIncludeTax: false);

        result.IsSuccess.Should().BeTrue();
        var calc = result.Value!;
        calc.UnitPrice.Should().Be(100m);
        calc.Subtotal.Should().Be(200m);
        calc.DiscountAmount.Should().Be(0m);
        calc.NetPrice.Should().Be(200m);
        calc.TaxableBase.Should().Be(200m);
        calc.TaxAmount.Should().Be(30m);
        calc.FinalPrice.Should().Be(230m);
        calc.TierLabel.Should().BeNull();
        calc.AppliedRules.Should().BeEmpty();
    }

    [Fact(DisplayName = "La escala por cantidad reemplaza el precio unitario")]
    public void Calculate_WithTier_AppliesTierUnitPrice()
    {
        var tiers = new[] { CreateTier(6m, 20m, 9.5m) };

        var result = PriceCalculator.Calculate(10m, 10m, tiers, NoPromotions, 0m, pricesIncludeTax: false);

        var calc = result.Value!;
        calc.UnitPrice.Should().Be(9.5m);
        calc.Subtotal.Should().Be(95m);
        calc.TierLabel.Should().Be("6 - 20");
        calc.AppliedRules.Should().Contain("ESCALA_6");
    }

    [Fact(DisplayName = "La cantidad en el borde superior pertenece a su escala")]
    public void Calculate_TierUpperBoundary_UsesTier()
    {
        var tiers = new[] { CreateTier(1m, 5m, 10m), CreateTier(6m, 20m, 9.5m) };

        var inRange = PriceCalculator.Calculate(12m, 20m, tiers, NoPromotions, 0m, pricesIncludeTax: false);
        var outOfRange = PriceCalculator.Calculate(12m, 21m, tiers, NoPromotions, 0m, pricesIncludeTax: false);

        inRange.Value!.UnitPrice.Should().Be(9.5m);
        outOfRange.Value!.UnitPrice.Should().Be(12m);
    }

    [Fact(DisplayName = "Una escala inactiva es ignorada")]
    public void Calculate_InactiveTier_IsIgnored()
    {
        var tier = CreateTier(1m, null, 8m);
        tier.SetActive(false).IsSuccess.Should().BeTrue();

        var result = PriceCalculator.Calculate(10m, 3m, [tier], NoPromotions, 0m, pricesIncludeTax: false);

        result.Value!.UnitPrice.Should().Be(10m);
    }

    [Fact(DisplayName = "Promoción porcentual descuenta sobre el subtotal")]
    public void Calculate_PercentagePromotion_AppliesDiscount()
    {
        var promotions = new[] { CreatePromotion("DIEZ", PromotionType.Percentage, 10m, priority: 1, isStackable: false) };

        var result = PriceCalculator.Calculate(100m, 1m, NoTiers, promotions, 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(10m);
        result.Value!.NetPrice.Should().Be(90m);
        result.Value!.AppliedRules.Should().Contain("PROMO_DIEZ");
    }

    [Fact(DisplayName = "Promoción de valor fijo descuenta por unidad")]
    public void Calculate_FixedAmountPromotion_IsPerUnit()
    {
        var promotions = new[] { CreatePromotion("CINCUENTA", PromotionType.FixedAmount, 0.5m, priority: 1, isStackable: false) };

        var result = PriceCalculator.Calculate(10m, 3m, NoTiers, promotions, 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(1.5m);
        result.Value!.NetPrice.Should().Be(28.5m);
    }

    [Fact(DisplayName = "Promoción de precio fijo reemplaza el precio unitario")]
    public void Calculate_FixedPricePromotion_ReplacesUnitPrice()
    {
        var promotions = new[] { CreatePromotion("PRECIO8", PromotionType.FixedPrice, 8m, priority: 1, isStackable: false) };

        var result = PriceCalculator.Calculate(10m, 2m, NoTiers, promotions, 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(4m);
        result.Value!.NetPrice.Should().Be(16m);
    }

    [Fact(DisplayName = "Dos promociones acumulables se suman por prioridad")]
    public void Calculate_TwoStackablePromotions_Accumulate()
    {
        var promotions = new[]
        {
            CreatePromotion("ALTA", PromotionType.Percentage, 10m, priority: 5, isStackable: true),
            CreatePromotion("BAJA", PromotionType.Percentage, 5m, priority: 3, isStackable: true),
        };

        var result = PriceCalculator.Calculate(100m, 1m, NoTiers, promotions, 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(15m);
        result.Value!.NetPrice.Should().Be(85m);
        result.Value!.AppliedRules.Should().Equal("PROMO_ALTA", "PROMO_BAJA");
    }

    [Fact(DisplayName = "Una promoción no acumulable descarta las de menor prioridad")]
    public void Calculate_NonStackable_DiscardsLowerPriority()
    {
        var promotions = new[]
        {
            CreatePromotion("ACUMULABLE", PromotionType.Percentage, 5m, priority: 20, isStackable: true),
            CreatePromotion("EXCLUSIVA", PromotionType.Percentage, 10m, priority: 10, isStackable: false),
            CreatePromotion("DESCARTADA", PromotionType.Percentage, 2m, priority: 5, isStackable: true),
        };

        var result = PriceCalculator.Calculate(100m, 1m, NoTiers, promotions, 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(15m);
        result.Value!.AppliedRules.Should().Equal("PROMO_ACUMULABLE", "PROMO_EXCLUSIVA");
        result.Value!.AppliedRules.Should().NotContain("PROMO_DESCARTADA");
    }

    [Fact(DisplayName = "Una promoción inactiva es ignorada")]
    public void Calculate_InactivePromotion_IsIgnored()
    {
        var promotion = CreatePromotion("APAGADA", PromotionType.Percentage, 10m, priority: 1, isStackable: false);
        promotion.SetActive(false).IsSuccess.Should().BeTrue();

        var result = PriceCalculator.Calculate(100m, 1m, NoTiers, [promotion], 0m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(0m);
        result.Value!.AppliedRules.Should().BeEmpty();
    }

    [Fact(DisplayName = "El descuento nunca deja el neto en negativo")]
    public void Calculate_DiscountCapsAtSubtotal()
    {
        var promotions = new[] { CreatePromotion("BRUTAL", PromotionType.FixedAmount, 100m, priority: 1, isStackable: false) };

        var result = PriceCalculator.Calculate(10m, 5m, NoTiers, promotions, 0.15m, pricesIncludeTax: false);

        result.Value!.DiscountAmount.Should().Be(50m);
        result.Value!.NetPrice.Should().Be(0m);
        result.Value!.TaxAmount.Should().Be(0m);
        result.Value!.FinalPrice.Should().Be(0m);
    }

    [Fact(DisplayName = "Precio con impuesto incluido desagrega base y valor")]
    public void Calculate_TaxIncluded_ExtractsTaxableBase()
    {
        var result = PriceCalculator.Calculate(115m, 1m, NoTiers, NoPromotions, 0.15m, pricesIncludeTax: true);

        var calc = result.Value!;
        calc.NetPrice.Should().Be(115m);
        calc.TaxableBase.Should().Be(100m);
        calc.TaxAmount.Should().Be(15m);
        calc.FinalPrice.Should().Be(115m);
        calc.PricesIncludeTax.Should().BeTrue();
    }

    [Fact(DisplayName = "El redondeo monetario es AwayFromZero a dos decimales")]
    public void Calculate_RoundsAwayFromZero()
    {
        var result = PriceCalculator.Calculate(10.005m, 1m, NoTiers, NoPromotions, 0m, pricesIncludeTax: false);

        result.Value!.Subtotal.Should().Be(10.01m);
        result.Value!.FinalPrice.Should().Be(10.01m);
    }

    [Fact(DisplayName = "Cantidad cero o negativa es rechazada")]
    public void Calculate_InvalidQuantity_Fails()
    {
        var result = PriceCalculator.Calculate(10m, 0m, NoTiers, NoPromotions, 0.15m, pricesIncludeTax: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.quantity.range");
    }

    [Fact(DisplayName = "Precio de lista negativo es rechazado")]
    public void Calculate_NegativePrice_Fails()
    {
        var result = PriceCalculator.Calculate(-1m, 1m, NoTiers, NoPromotions, 0.15m, pricesIncludeTax: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price.range");
    }

    [Fact(DisplayName = "Tarifa de impuesto fuera de 0-1 es rechazada")]
    public void Calculate_InvalidTaxRate_Fails()
    {
        var result = PriceCalculator.Calculate(10m, 1m, NoTiers, NoPromotions, 1.5m, pricesIncludeTax: false);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.tax_rate.range");
    }

    private static QuantityTier CreateTier(decimal from, decimal? to, decimal unitPrice) =>
        QuantityTier.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), from, to, unitPrice).Value!;

    private static Promotion CreatePromotion(
        string code,
        PromotionType type,
        decimal value,
        int priority,
        bool isStackable) =>
        Promotion.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            code,
            $"Promo {code}",
            null,
            type,
            value,
            new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            null,
            priority,
            isStackable).Value!;
}
