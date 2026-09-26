using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Cálculo puro de precio comercial. Aplica escala por cantidad, promociones (prioridad y
/// acumulabilidad), descuento, impuesto y redondeo fiscal. No accede a base de datos ni conoce
/// listas o tenants: recibe insumos ya resueltos.
/// </summary>
public static class PriceCalculator
{
    private const decimal MaxTaxRate = 1m;

    /// <summary>
    /// Calcula el desglose de una línea. Las promociones recibidas se asumen ya filtradas por
    /// alcance y vigencia; las inactivas se ignoran.
    /// </summary>
    public static Result<PriceCalculation> Calculate(
        decimal listPrice,
        decimal quantity,
        IReadOnlyList<QuantityTier> tiers,
        IReadOnlyList<Promotion> promotions,
        decimal taxRate,
        bool pricesIncludeTax)
    {
        if (listPrice < 0)
        {
            return Result.Failure<PriceCalculation>(
                new Error("catalog.pricing.price.range", "El precio de lista no puede ser negativo.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure<PriceCalculation>(
                new Error("catalog.pricing.quantity.range", "La cantidad debe ser mayor que cero.", ErrorType.Validation));
        }

        if (taxRate < 0 || taxRate > MaxTaxRate)
        {
            return Result.Failure<PriceCalculation>(
                new Error("catalog.pricing.tax_rate.range", "La tarifa de impuesto debe estar entre 0 y 1.", ErrorType.Validation));
        }

        var appliedRules = new List<string>();

        var tier = tiers
            .Where(t => t.IsActive && t.Includes(quantity))
            .OrderByDescending(t => t.QuantityFrom)
            .FirstOrDefault();

        var unitPrice = tier?.UnitPrice ?? listPrice;
        string? tierLabel = null;
        if (tier is not null)
        {
            tierLabel = tier.QuantityTo is null
                ? $"{tier.QuantityFrom:0.####}+"
                : $"{tier.QuantityFrom:0.####} - {tier.QuantityTo.Value:0.####}";
            appliedRules.Add($"ESCALA_{tier.QuantityFrom:0.####}");
        }

        var subtotal = RoundMoney(unitPrice * quantity);
        var discount = CalculateDiscount(subtotal, unitPrice, quantity, promotions, appliedRules);
        var discountAmount = Math.Min(RoundMoney(discount), subtotal);
        var netPrice = subtotal - discountAmount;

        decimal taxableBase;
        decimal taxAmount;
        decimal finalPrice;

        if (pricesIncludeTax && taxRate > 0m)
        {
            taxableBase = RoundMoney(netPrice / (1m + taxRate));
            taxAmount = netPrice - taxableBase;
            finalPrice = netPrice;
        }
        else
        {
            taxableBase = netPrice;
            taxAmount = RoundMoney(netPrice * taxRate);
            finalPrice = netPrice + taxAmount;
        }

        return Result.Success(
            new PriceCalculation(
                listPrice,
                unitPrice,
                tierLabel,
                subtotal,
                discountAmount,
                netPrice,
                taxableBase,
                taxAmount,
                finalPrice,
                taxRate,
                pricesIncludeTax,
                appliedRules));
    }

    private static decimal CalculateDiscount(
        decimal subtotal,
        decimal unitPrice,
        decimal quantity,
        IReadOnlyList<Promotion> promotions,
        List<string> appliedRules)
    {
        var ordered = promotions
            .Where(p => p.IsActive)
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code, StringComparer.Ordinal)
            .ToList();

        var discount = 0m;
        foreach (var promotion in ordered)
        {
            discount += promotion.Type switch
            {
                PromotionType.Percentage => subtotal * promotion.Value / 100m,
                PromotionType.FixedAmount => promotion.Value * quantity,
                PromotionType.FixedPrice => Math.Max(0m, unitPrice - promotion.Value) * quantity,
                _ => 0m,
            };
            appliedRules.Add($"PROMO_{promotion.Code}");

            // Una promoción no acumulable corta las de menor prioridad.
            if (!promotion.IsStackable)
            {
                break;
            }
        }

        return discount;
    }

    private static decimal RoundMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
