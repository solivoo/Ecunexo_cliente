using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Storefront;

/// <summary>
/// Precios promocionales de vitrina: reutiliza el motor de precios con cantidad 1
/// para mostrar el descuento vigente sin alterar el precio de lista.
/// </summary>
public static class StorefrontPromotions
{
    public static IReadOnlyList<Promotion> FilterForItem(
        IReadOnlyList<Promotion> activePromotions,
        Guid itemId,
        Guid? parentItemId)
    {
        if (activePromotions.Count == 0)
        {
            return Array.Empty<Promotion>();
        }

        var itemReference = itemId.ToString();
        var parentReference = parentItemId?.ToString();

        return activePromotions
            .Where(promotion => promotion.Targets.Any(target =>
                target.TargetType == PromotionTargetType.AllItems
                || ((target.TargetType == PromotionTargetType.Product
                        || target.TargetType == PromotionTargetType.Variant)
                    && (References(target, itemReference)
                        || (parentReference is not null && References(target, parentReference))))))
            .ToList();
    }

    public static decimal ApplyDiscount(decimal listPrice, IReadOnlyList<Promotion> promotions)
    {
        if (listPrice <= 0m || promotions.Count == 0)
        {
            return listPrice;
        }

        var calculation = PriceCalculator.Calculate(
            listPrice,
            quantity: 1m,
            Array.Empty<QuantityTier>(),
            promotions,
            taxRate: 0m,
            pricesIncludeTax: false);

        return calculation.IsSuccess ? calculation.Value!.NetPrice : listPrice;
    }

    public static int? DiscountPercent(decimal listPrice, decimal finalPrice)
    {
        if (listPrice <= 0m || finalPrice >= listPrice)
        {
            return null;
        }

        var percent = (int)Math.Round(
            (1m - (finalPrice / listPrice)) * 100m,
            MidpointRounding.AwayFromZero);

        return percent > 0 ? percent : null;
    }

    private static bool References(PromotionTarget target, string reference) =>
        string.Equals(target.TargetReference, reference, StringComparison.OrdinalIgnoreCase);
}
