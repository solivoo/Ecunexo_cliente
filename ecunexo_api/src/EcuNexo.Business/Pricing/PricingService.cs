using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

/// <summary>
/// Orquesta la resolución de precio: lista, vigencia, herencia de padre matriz, promociones,
/// impuesto y cálculo puro. No modifica precios ni stock.
/// </summary>
public sealed class PricingService : IPricingService
{
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPromotionRepository _promotions;
    private readonly ICatalogItemRepository _items;
    private readonly ITaxRateProvider _taxRates;

    public PricingService(
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        IPromotionRepository promotions,
        ICatalogItemRepository items,
        ITaxRateProvider taxRates)
    {
        _priceLists = priceLists;
        _productPrices = productPrices;
        _promotions = promotions;
        _items = items;
        _taxRates = taxRates;
    }

    public async Task<Result<PricingResult>> ResolveAsync(
        Guid tenantId,
        PricingRequest request,
        CancellationToken ct)
    {
        if (request.Quantity <= 0)
        {
            return Result.Failure<PricingResult>(
                new Error("catalog.pricing.quantity.range", "La cantidad debe ser mayor que cero.", ErrorType.Validation));
        }

        var item = await _items.GetActiveByIdAsync(tenantId, request.CatalogItemId, ct).ConfigureAwait(false);
        if (item is null || item.Kind != CatalogItemKind.Physical)
        {
            return Result.Failure<PricingResult>(
                new Error("catalog.pricing.item.not_found", "El producto no existe o no está disponible.", ErrorType.NotFound));
        }

        var list = await ResolvePriceListAsync(tenantId, request, ct).ConfigureAwait(false);
        if (list.IsFailure)
        {
            return Result.Failure<PricingResult>(list.Error!);
        }

        var priceList = list.Value!;
        var productPrice = await _productPrices
            .GetVigentAsync(tenantId, priceList.Id, item.Id, request.Date, ct)
            .ConfigureAwait(false);

        var inheritedFromParent = false;
        if (productPrice is null && item.ParentId is { } parentId)
        {
            productPrice = await _productPrices
                .GetVigentAsync(tenantId, priceList.Id, parentId, request.Date, ct)
                .ConfigureAwait(false);
            inheritedFromParent = productPrice is not null;
        }

        if (productPrice is null)
        {
            return Result.Failure<PricingResult>(
                new Error("catalog.pricing.price.not_found", "El producto no tiene precio vigente en la lista indicada.", ErrorType.NotFound));
        }

        var moment = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var applicable = await _promotions
            .ListApplicableAsync(tenantId, item.Id, item.ParentId, item.CategoryId, moment, ct)
            .ConfigureAwait(false);
        var activePromotions = applicable.Where(p => p.IsApplicableOn(moment)).ToList();

        var taxRate = await _taxRates
            .GetRateAsync(tenantId, item.Id, request.Date, ct)
            .ConfigureAwait(false);

        var calculation = PriceCalculator.Calculate(
            productPrice.Price,
            request.Quantity,
            productPrice.Tiers,
            activePromotions,
            taxRate,
            priceList.PricesIncludeTax);
        if (calculation.IsFailure)
        {
            return Result.Failure<PricingResult>(calculation.Error!);
        }

        var calc = calculation.Value!;
        var rules = new List<string> { $"LISTA_{priceList.Code}" };
        if (inheritedFromParent)
        {
            rules.Add("PRECIO_HEREDADO_PADRE");
        }

        rules.AddRange(calc.AppliedRules);

        var result = new PricingResult(
            item.Id,
            priceList.Id,
            priceList.Code,
            calc.ListPrice,
            calc.UnitPrice,
            calc.TierLabel is null ? null : calc.UnitPrice,
            calc.TierLabel,
            calc.Subtotal,
            calc.DiscountAmount,
            calc.NetPrice,
            calc.TaxableBase,
            calc.TaxAmount,
            calc.FinalPrice,
            calc.TaxRate,
            calc.PricesIncludeTax,
            priceList.Currency,
            rules);

        return Result.Success(result);
    }

    private async Task<Result<PriceList>> ResolvePriceListAsync(
        Guid tenantId,
        PricingRequest request,
        CancellationToken ct)
    {
        PriceList? list;
        if (request.PriceListId is { } priceListId)
        {
            list = await _priceLists.GetByIdAsync(tenantId, priceListId, ct).ConfigureAwait(false);
        }
        else
        {
            list = await _priceLists.GetDefaultAsync(tenantId, ct).ConfigureAwait(false);
        }

        if (list is null)
        {
            return Result.Failure<PriceList>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        if (!list.IsValidOn(request.Date))
        {
            return Result.Failure<PriceList>(
                new Error("catalog.pricing.price_list.not_valid", "La lista de precios no está vigente para la fecha indicada.", ErrorType.Conflict));
        }

        return Result.Success(list);
    }
}
