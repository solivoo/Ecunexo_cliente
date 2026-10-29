using EcuNexo.Business.Catalog;
using EcuNexo.Business.Inventory;
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
    private readonly IStockRepository? _stocks;

    public PricingService(
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        IPromotionRepository promotions,
        ICatalogItemRepository items,
        ITaxRateProvider taxRates,
        IStockRepository? stocks = null)
    {
        _priceLists = priceLists;
        _productPrices = productPrices;
        _promotions = promotions;
        _items = items;
        _taxRates = taxRates;
        _stocks = stocks;
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
        if (item is null)
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

        var rules = new List<string> { $"LISTA_{priceList.Code}" };
        if (inheritedFromParent)
        {
            rules.Add("PRECIO_HEREDADO_PADRE");
        }

        decimal basePrice;
        IReadOnlyList<QuantityTier> tiers;
        VolumeDiscountScheme? volumeScheme;

        if (productPrice is not null)
        {
            basePrice = productPrice.Price;
            tiers = productPrice.Tiers;
            volumeScheme = productPrice.VolumeDiscountScheme;
        }
        else if (priceList.IsDefault && item.BasePrice is > 0m)
        {
            basePrice = item.BasePrice.Value;
            tiers = Array.Empty<QuantityTier>();
            volumeScheme = null;
            rules.Add("PRECIO_BASE_CATALOGO");
        }
        else
        {
            return Result.Failure<PricingResult>(
                new Error("catalog.pricing.price.not_found", "El producto no tiene precio vigente en la lista indicada.", ErrorType.NotFound));
        }

        var moment = request.Date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var applicable = await _promotions
            .ListApplicableAsync(tenantId, item.Id, item.ParentId, moment, ct)
            .ConfigureAwait(false);
        var activePromotions = applicable.Where(p => p.IsApplicableOn(moment)).ToList();

        var taxRate = await _taxRates
            .GetRateAsync(tenantId, item.Id, request.Date, ct)
            .ConfigureAwait(false);

        var calculation = PriceCalculator.Calculate(
            basePrice,
            request.Quantity,
            tiers,
            activePromotions,
            taxRate,
            priceList.PricesIncludeTax,
            volumeScheme);
        if (calculation.IsFailure)
        {
            return Result.Failure<PricingResult>(calculation.Error!);
        }

        var calc = calculation.Value!;
        rules.AddRange(calc.AppliedRules);

        decimal? averageCost = null;
        decimal? marginPercent = null;
        var isBelowCost = false;

        if (_stocks is not null)
        {
            var stockList = await _stocks.ListByTenantAsync(tenantId, request.WarehouseId, ct).ConfigureAwait(false);
            var itemStocks = stockList.Where(s => s.CatalogItemId == item.Id && s.AverageCost > 0).ToList();
            if (itemStocks.Count > 0)
            {
                var positiveStock = itemStocks.Where(s => s.Quantity > 0).ToList();
                var totalQty = positiveStock.Sum(s => s.Quantity);
                averageCost = totalQty > 0
                    ? Math.Round(positiveStock.Sum(s => s.Quantity * s.AverageCost) / totalQty, 4)
                    : Math.Round(itemStocks.Average(s => s.AverageCost), 4);

                if (averageCost > 0m)
                {
                    var unitNetExcludingTax = request.Quantity > 0m ? calc.TaxableBase / request.Quantity : calc.TaxableBase;
                    if (unitNetExcludingTax > 0m)
                    {
                        marginPercent = Math.Round(((unitNetExcludingTax - averageCost.Value) / unitNetExcludingTax) * 100m, 2);
                    }

                    if (unitNetExcludingTax < averageCost.Value)
                    {
                        isBelowCost = true;
                        rules.Add("MARGIN_WARNING_BELOW_COST");
                    }
                }
            }
        }

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
            rules,
            averageCost,
            marginPercent,
            isBelowCost);

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
