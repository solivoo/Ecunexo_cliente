using System.Globalization;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.CalculateStorefrontQuote;

public sealed class CalculateStorefrontQuoteHandler
    : IQueryHandler<CalculateStorefrontQuoteQuery, StorefrontCheckoutQuoteDto>
{
    private const decimal DefaultTaxRate = 0.15m;

    private readonly ITenantRepository _tenants;
    private readonly IEcommerceStorefrontSettingsReader _settings;
    private readonly IPricingService _pricing;
    private readonly IPromotionRepository _promotions;

    public CalculateStorefrontQuoteHandler(
        ITenantRepository tenants,
        IEcommerceStorefrontSettingsReader settings,
        IPricingService pricing,
        IPromotionRepository promotions)
    {
        _tenants = tenants;
        _settings = settings;
        _pricing = pricing;
        _promotions = promotions;
    }

    public async Task<Result<StorefrontCheckoutQuoteDto>> Handle(
        CalculateStorefrontQuoteQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontCheckoutQuoteDto>(tenantError);
        }

        var settings = await _settings.ResolveAsync(query.TenantId, ct).ConfigureAwait(false);
        var shippingCost = 0m;
        if (!string.IsNullOrWhiteSpace(query.ShippingMethod)
            && EcommerceStorefrontSettingsReader.TryParseShippingMethod(query.ShippingMethod, out var parsedShipping))
        {
            var option = settings.ShippingMethods.FirstOrDefault(o => o.Method == parsedShipping);
            if (option is not null)
            {
                shippingCost = option.Cost;
            }
        }
        else if (settings.ShippingMethods.Count > 0)
        {
            shippingCost = settings.ShippingMethods[0].Cost;
        }

        if (query.Items.Count == 0)
        {
            return Result.Success(new StorefrontCheckoutQuoteDto(
                Items: [],
                GrossSubtotal: 0m,
                PromotionDiscountAmount: 0m,
                CouponDiscountAmount: 0m,
                DiscountAmount: 0m,
                Subtotal: 0m,
                TaxRate: DefaultTaxRate,
                TaxAmount: 0m,
                PricesIncludeTax: true,
                ShippingCost: shippingCost,
                TotalAmount: shippingCost));
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTimeOffset.UtcNow;

        var baseResults = new List<(Guid ItemId, int Quantity, PricingResult Resolved)>(query.Items.Count);
        foreach (var item in query.Items)
        {
            if (item.Quantity <= 0)
            {
                continue;
            }

            var resolved = await _pricing.ResolveAsync(
                query.TenantId,
                new PricingRequest(
                    item.CatalogItemId,
                    item.Quantity,
                    today,
                    PricesIncludeTaxOverride: true),
                ct).ConfigureAwait(false);

            if (resolved.IsFailure)
            {
                return Result.Failure<StorefrontCheckoutQuoteDto>(resolved.Error!);
            }

            baseResults.Add((item.CatalogItemId, item.Quantity, resolved.Value!));
        }

        var grossSubtotal = Round(baseResults.Sum(r => r.Resolved.ListPrice * r.Quantity));
        var autoDiscountTotal = Round(baseResults.Sum(r =>
            (r.Resolved.ListPrice * r.Quantity) - r.Resolved.NetPrice));

        string? normalizedCouponCode = string.IsNullOrWhiteSpace(query.CouponCode)
            ? null
            : query.CouponCode.Trim().ToUpperInvariant();
        var couponApplied = false;
        string? couponMessage = null;
        Promotion? validCoupon = null;

        if (normalizedCouponCode is not null)
        {
            var coupon = await _promotions
                .GetTrackedByCodeAsync(query.TenantId, normalizedCouponCode, ct)
                .ConfigureAwait(false);

            if (coupon is null || !coupon.IsActive)
            {
                couponMessage = "El código promocional ingresado no existe o no está activo.";
            }
            else if (now < coupon.StartsAt)
            {
                couponMessage = "Este código promocional aún no está vigente.";
            }
            else if (coupon.EndsAt is not null && now > coupon.EndsAt.Value)
            {
                couponMessage = "Este código promocional ha expirado.";
            }
            else if (!coupon.HasAvailableUses())
            {
                couponMessage = "Este código promocional ya alcanzó su límite de usos.";
            }
            else if (coupon.MinOrderAmount is > 0m && grossSubtotal < coupon.MinOrderAmount.Value)
            {
                couponMessage = $"Este código requiere una compra mínima de ${coupon.MinOrderAmount.Value.ToString("0.00", CultureInfo.InvariantCulture)}.";
            }
            else
            {
                validCoupon = coupon;
            }
        }

        var finalResults = baseResults;
        if (validCoupon is not null)
        {
            var withCouponResults = new List<(Guid ItemId, int Quantity, PricingResult Resolved)>(baseResults.Count);
            foreach (var entry in baseResults)
            {
                var resolvedWithCoupon = await _pricing.ResolveAsync(
                    query.TenantId,
                    new PricingRequest(
                        entry.ItemId,
                        entry.Quantity,
                        today,
                        CouponCode: validCoupon.Code,
                        PricesIncludeTaxOverride: true),
                    ct).ConfigureAwait(false);

                withCouponResults.Add((
                    entry.ItemId,
                    entry.Quantity,
                    resolvedWithCoupon.IsSuccess ? resolvedWithCoupon.Value! : entry.Resolved));
            }

            var totalDiscountWithCoupon = Round(withCouponResults.Sum(r =>
                (r.Resolved.ListPrice * r.Quantity) - r.Resolved.NetPrice));

            if (totalDiscountWithCoupon > autoDiscountTotal)
            {
                finalResults = withCouponResults;
                couponApplied = true;
                couponMessage = $"Código {validCoupon.Code} aplicado.";
            }
            else
            {
                couponMessage = "Este código promocional no aplica a los productos de tu carrito.";
            }
        }

        var lines = new List<StorefrontCheckoutQuoteLineDto>(finalResults.Count);
        foreach (var entry in finalResults)
        {
            var r = entry.Resolved;
            var lineGross = Round(r.ListPrice * entry.Quantity);
            var lineTotal = Round(r.FinalPrice);
            var lineDiscount = Math.Max(0m, lineGross - lineTotal);
            var effectiveUnit = entry.Quantity > 0
                ? Round(lineTotal / entry.Quantity)
                : r.UnitPrice;
            var discountPercent = lineGross > 0m && lineTotal < lineGross
                ? (int)Math.Round((1m - (lineTotal / lineGross)) * 100m, MidpointRounding.AwayFromZero)
                : (int?)null;

            lines.Add(new StorefrontCheckoutQuoteLineDto(
                entry.ItemId,
                entry.Quantity,
                r.ListPrice,
                effectiveUnit,
                lineGross,
                lineDiscount,
                r.TaxableBase,
                r.TaxAmount,
                lineTotal,
                discountPercent > 0 ? discountPercent : null));
        }

        var totalDiscount = Round(lines.Sum(l => l.LineDiscount));
        var couponDiscountAmount = couponApplied
            ? Math.Max(0m, Round(totalDiscount - autoDiscountTotal))
            : 0m;
        var promotionDiscountAmount = Math.Max(0m, Round(totalDiscount - couponDiscountAmount));
        var subtotalExTax = Round(lines.Sum(l => l.LineSubtotalExTax));
        var taxAmount = Round(lines.Sum(l => l.LineTaxAmount));
        var taxRate = finalResults.Count > 0 ? finalResults[0].Resolved.TaxRate : DefaultTaxRate;
        var totalAmount = Round(subtotalExTax + taxAmount + shippingCost);

        return Result.Success(new StorefrontCheckoutQuoteDto(
            Items: lines,
            GrossSubtotal: grossSubtotal,
            PromotionDiscountAmount: promotionDiscountAmount,
            CouponDiscountAmount: couponDiscountAmount,
            DiscountAmount: totalDiscount,
            Subtotal: subtotalExTax,
            TaxRate: taxRate,
            TaxAmount: taxAmount,
            PricesIncludeTax: true,
            ShippingCost: shippingCost,
            TotalAmount: totalAmount,
            CouponCode: couponApplied ? validCoupon!.Code : normalizedCouponCode,
            CouponApplied: couponApplied,
            CouponMessage: couponMessage));
    }

    private static decimal Round(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
