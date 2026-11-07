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
        bool pricesIncludeTax,
        VolumeDiscountScheme? volumeScheme = null)
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

        decimal volumeDiscount = 0m;
        if (tier is null && volumeScheme is not null && volumeScheme.IsActive)
        {
            var schemeTier = volumeScheme.Tiers
                .Where(t => t.IsActive && t.Includes(quantity))
                .OrderByDescending(t => t.QuantityFrom)
                .FirstOrDefault();

            if (schemeTier is not null)
            {
                tierLabel = schemeTier.QuantityTo is null
                    ? $"{schemeTier.QuantityFrom:0.####}+"
                    : $"{schemeTier.QuantityFrom:0.####} - {schemeTier.QuantityTo.Value:0.####}";

                switch (volumeScheme.Type)
                {
                    case VolumeDiscountSchemeType.Percentage:
                        volumeDiscount = (unitPrice * quantity) * schemeTier.Value / 100m;
                        appliedRules.Add($"ESQUEMA_{volumeScheme.Name}_{schemeTier.QuantityFrom:0.####}_{schemeTier.Value:0.##}%");
                        break;
                    case VolumeDiscountSchemeType.FixedAmount:
                        volumeDiscount = schemeTier.Value * quantity;
                        appliedRules.Add($"ESQUEMA_{volumeScheme.Name}_{schemeTier.QuantityFrom:0.####}_${schemeTier.Value:0.00}");
                        break;
                    case VolumeDiscountSchemeType.FixedPrice:
                        if (schemeTier.Value < unitPrice)
                        {
                            volumeDiscount = (unitPrice - schemeTier.Value) * quantity;
                        }
                        appliedRules.Add($"ESQUEMA_{volumeScheme.Name}_{schemeTier.QuantityFrom:0.####}_PVP${schemeTier.Value:0.00}");
                        break;
                }
            }
        }

        var subtotal = RoundMoney(unitPrice * quantity);
        var baseForPromotions = Math.Max(0m, subtotal - volumeDiscount);
        var promoDiscount = CalculateDiscount(baseForPromotions, unitPrice, quantity, promotions, appliedRules);
        var totalDiscount = volumeDiscount + promoDiscount;
        var discountAmount = Math.Min(RoundMoney(totalDiscount), subtotal);
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
        var active = promotions.Where(p => p.IsActive).ToList();
        var automatic = active
            .Where(p => !p.RequiresCode)
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code, StringComparer.Ordinal)
            .ToList();

        var autoDiscount = 0m;
        var autoRules = new List<string>();
        var effectiveUnitPrice = quantity > 0m ? subtotal / quantity : unitPrice;

        foreach (var promotion in automatic)
        {
            autoDiscount += ComputeSinglePromotionDiscount(promotion, subtotal, effectiveUnitPrice, quantity);
            autoRules.Add($"PROMO_{promotion.Code}");

            // Una promoción no acumulable corta las de menor prioridad.
            if (!promotion.IsStackable)
            {
                break;
            }
        }

        var coupons = active
            .Where(p => p.RequiresCode)
            .OrderByDescending(p => p.Priority)
            .ThenBy(p => p.Code, StringComparer.Ordinal)
            .ToList();

        if (coupons.Count == 0)
        {
            appliedRules.AddRange(autoRules);
            return autoDiscount;
        }

        var coupon = coupons[0];
        if (coupon.IsStackable || autoDiscount <= 0m)
        {
            appliedRules.AddRange(autoRules);
            var remainingSubtotal = Math.Max(0m, subtotal - autoDiscount);
            var remainingUnit = quantity > 0m ? remainingSubtotal / quantity : 0m;
            var couponDiscount = ComputeSinglePromotionDiscount(coupon, remainingSubtotal, remainingUnit, quantity);
            if (couponDiscount > 0m)
            {
                appliedRules.Add($"CUPON_{coupon.Code}");
            }

            return autoDiscount + couponDiscount;
        }

        var standaloneCouponDiscount = ComputeSinglePromotionDiscount(coupon, subtotal, effectiveUnitPrice, quantity);
        if (standaloneCouponDiscount > autoDiscount)
        {
            appliedRules.Add($"CUPON_{coupon.Code}");
            return standaloneCouponDiscount;
        }

        appliedRules.AddRange(autoRules);
        return autoDiscount;
    }

    private static decimal ComputeSinglePromotionDiscount(
        Promotion promotion,
        decimal subtotal,
        decimal effectiveUnitPrice,
        decimal quantity) =>
        promotion.Type switch
        {
            PromotionType.Percentage => subtotal * promotion.Value / 100m,
            PromotionType.FixedAmount => promotion.Value * quantity,
            PromotionType.FixedPrice => Math.Max(0m, effectiveUnitPrice - promotion.Value) * quantity,
            _ => 0m,
        };

    private static decimal RoundMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
