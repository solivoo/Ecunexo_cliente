using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.Storefront;

/// <summary>
/// Carga compartida de la vitrina: ítems activos raíz con imágenes y variantes, stock,
/// precio resuelto y atributos canónicos. MVP: filtros y facetas se calculan en memoria
/// sobre el catálogo del tenant; a futuro puede indexarse si el volumen crece.
/// </summary>
public sealed class StorefrontCatalogReader
{
    public const int NewWindowDays = 30;

    private readonly IStorefrontCatalogRepository _products;
    private readonly IStockRepository _stock;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;

    public StorefrontCatalogReader(
        IStorefrontCatalogRepository products,
        IStockRepository stock,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices)
    {
        _products = products;
        _stock = stock;
        _priceLists = priceLists;
        _productPrices = productPrices;
    }

    public async Task<IReadOnlyList<StorefrontCatalogProduct>> LoadAsync(
        Guid tenantId,
        CancellationToken ct)
    {
        var items = await _products
            .ListActiveRootsAsync(tenantId, ct)
            .ConfigureAwait(false);
        if (items.Count == 0)
        {
            return Array.Empty<StorefrontCatalogProduct>();
        }

        var ids = CollectIds(items);

        var availability = await _stock
            .SumAvailableByItemIdsAsync(tenantId, ids, ct)
            .ConfigureAwait(false);

        var defaultList = await _priceLists
            .GetDefaultAsync(tenantId, ct)
            .ConfigureAwait(false);

        var resolvedPrices = defaultList is null
            ? new Dictionary<Guid, decimal>()
            : await _productPrices
                .ListVigentByItemIdsAsync(
                    tenantId,
                    defaultList.Id,
                    ids,
                    DateOnly.FromDateTime(DateTime.UtcNow),
                    ct)
                .ConfigureAwait(false);

        var now = DateTimeOffset.UtcNow;
        return items
            .Select(item => new StorefrontCatalogProduct(
                item,
                resolvedPrices.TryGetValue(item.Id, out var resolved) ? resolved : item.BasePrice,
                SumAvailability(item, availability) > 0m,
                now - item.CreatedAt <= TimeSpan.FromDays(NewWindowDays),
                ToReadOnlyAttributes(StorefrontFacetCatalog.ExtractAttributes(item))))
            .ToList();
    }

    private static Dictionary<string, IReadOnlyList<string>> ToReadOnlyAttributes(
        IReadOnlyDictionary<string, List<string>> attributes) =>
        attributes.ToDictionary(
            pair => pair.Key,
            pair => (IReadOnlyList<string>)pair.Value,
            StringComparer.Ordinal);

    private static List<Guid> CollectIds(IReadOnlyList<CatalogItem> items)
    {
        var ids = new List<Guid>();
        foreach (var item in items)
        {
            ids.Add(item.Id);
            foreach (var variant in item.Variants)
            {
                ids.Add(variant.Id);
            }
        }

        return ids.Distinct().ToList();
    }

    private static decimal SumAvailability(
        CatalogItem item,
        IReadOnlyDictionary<Guid, decimal> availability)
    {
        var total = availability.TryGetValue(item.Id, out var own) ? own : 0m;
        foreach (var variant in item.Variants)
        {
            if (availability.TryGetValue(variant.Id, out var available))
            {
                total += available;
            }
        }

        return total;
    }
}

public sealed record StorefrontCatalogProduct(
    CatalogItem Item,
    decimal? Price,
    bool InStock,
    bool IsNew,
    IReadOnlyDictionary<string, IReadOnlyList<string>> Attributes)
{
    public IReadOnlyList<string> Colors =>
        Attributes.TryGetValue("color", out var colors) ? colors : Array.Empty<string>();
}
