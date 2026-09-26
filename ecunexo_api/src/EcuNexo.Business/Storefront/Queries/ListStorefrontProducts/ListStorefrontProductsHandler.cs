using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;

public sealed class ListStorefrontProductsHandler
    : IQueryHandler<ListStorefrontProductsQuery, StorefrontProductPageDto>
{
    private const int MaxPageSize = 48;

    private readonly IStorefrontCatalogRepository _products;
    private readonly IStockRepository _stock;
    private readonly ITenantRepository _tenants;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;

    public ListStorefrontProductsHandler(
        IStorefrontCatalogRepository products,
        IStockRepository stock,
        ITenantRepository tenants,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices)
    {
        _products = products;
        _stock = stock;
        _tenants = tenants;
        _priceLists = priceLists;
        _productPrices = productPrices;
    }

    public async Task<Result<StorefrontProductPageDto>> Handle(
        ListStorefrontProductsQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontProductPageDto>(tenantError);
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var defaultList = await _priceLists.GetDefaultAsync(query.TenantId, ct).ConfigureAwait(false);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var filter = new StorefrontProductFilter(
            query.Search,
            query.Sort,
            page,
            pageSize,
            defaultList?.Id,
            today);

        var (items, totalCount) = await _products
            .ListActiveRootsAsync(query.TenantId, filter, ct)
            .ConfigureAwait(false);

        var availability = await LoadAvailabilityAsync(query.TenantId, items, ct).ConfigureAwait(false);

        var resolvedPrices = defaultList is null
            ? new Dictionary<Guid, decimal>()
            : await _productPrices
                .ListVigentByItemIdsAsync(
                    query.TenantId,
                    defaultList.Id,
                    items.Select(i => i.Id).ToList(),
                    today,
                    ct)
                .ConfigureAwait(false);

        var dtos = items
            .Select(item =>
            {
                var image = ResolveMainImage(item);
                var available = SumAvailability(item, availability);
                var price = resolvedPrices.TryGetValue(item.Id, out var resolved)
                    ? resolved
                    : item.BasePrice;

                return new StorefrontProductListItemDto(
                    item.Id,
                    item.Kind,
                    item.Name,
                    item.Description,
                    price,
                    image?.ThumbUrl,
                    image?.MediumUrl,
                    available > 0m,
                    item.Variants.Count > 0,
                    item.Variants.Count,
                    item.CreatedAt);
            })
            .ToList();

        return Result.Success(new StorefrontProductPageDto(dtos, totalCount, page, pageSize));
    }

    private async Task<IReadOnlyDictionary<Guid, decimal>> LoadAvailabilityAsync(
        Guid tenantId,
        IReadOnlyList<CatalogItem> items,
        CancellationToken ct)
    {
        var ids = new HashSet<Guid>();
        foreach (var item in items)
        {
            ids.Add(item.Id);
            foreach (var variant in item.Variants)
            {
                ids.Add(variant.Id);
            }
        }

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, decimal>();
        }

        return await _stock
            .SumAvailableByItemIdsAsync(tenantId, ids, ct)
            .ConfigureAwait(false);
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

    private static CatalogItemImage? ResolveMainImage(CatalogItem item)
    {
        var modelImages = item.Images
            .Where(i => i.GroupValue is null)
            .OrderBy(i => i.DisplayOrder)
            .ToList();

        return modelImages.FirstOrDefault(i => i.IsMain)
            ?? modelImages.FirstOrDefault()
            ?? item.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault(i => i.IsMain)
            ?? item.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault();
    }
}
