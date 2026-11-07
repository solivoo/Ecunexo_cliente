using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;

public sealed class ListStorefrontProductsHandler
    : IQueryHandler<ListStorefrontProductsQuery, StorefrontProductPageDto>
{
    private const int MaxPageSize = 48;

    private readonly ITenantRepository _tenants;
    private readonly StorefrontCatalogReader _reader;

    public ListStorefrontProductsHandler(
        ITenantRepository tenants,
        StorefrontCatalogReader reader)
    {
        _tenants = tenants;
        _reader = reader;
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

        var products = await _reader.LoadAsync(query.TenantId, ct).ConfigureAwait(false);

        var filtered = products
            .Where(product => Matches(product, query))
            .ToList();

        var ordered = ApplySort(filtered, query.Sort);
        var totalCount = ordered.Count;

        var dtos = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapItem)
            .ToList();

        return Result.Success(new StorefrontProductPageDto(dtos, totalCount, page, pageSize));
    }

    private static bool Matches(StorefrontCatalogProduct product, ListStorefrontProductsQuery query)
    {
        if (!MatchesSearch(product.Item, query.Search))
        {
            return false;
        }

        if (query.PriceMin is { } min && (product.Price is null || product.Price < min))
        {
            return false;
        }

        if (query.PriceMax is { } max && (product.Price is null || product.Price > max))
        {
            return false;
        }

        if (query.InStock && !product.InStock)
        {
            return false;
        }

        if (query.New && !product.IsNew)
        {
            return false;
        }

        return MatchesFacets(product, query.Facets);
    }

    private static bool MatchesSearch(CatalogItem item, string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return true;
        }

        var needle = StorefrontFacetCatalog.NormalizeForMatch(search);
        if (needle.Length == 0)
        {
            return true;
        }

        return Contains(item.Name, needle)
            || Contains(item.Sku, needle)
            || Contains(item.Description, needle);
    }

    private static bool Contains(string? value, string needle) =>
        !string.IsNullOrEmpty(value)
        && StorefrontFacetCatalog.NormalizeForMatch(value).Contains(needle, StringComparison.Ordinal);

    private static bool MatchesFacets(
        StorefrontCatalogProduct product,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? facets)
    {
        if (facets is null || facets.Count == 0)
        {
            return true;
        }

        foreach (var (rawKey, selected) in facets)
        {
            if (selected.Count == 0
                || !StorefrontFacetCatalog.TryCanonicalizeKey(rawKey, out var key, out _))
            {
                continue;
            }

            if (!product.Attributes.TryGetValue(key, out var productValues)
                || productValues.Count == 0)
            {
                return false;
            }

            var available = productValues
                .Select(StorefrontFacetCatalog.NormalizeForMatch)
                .ToHashSet(StringComparer.Ordinal);

            if (!selected.Any(value => available.Contains(
                StorefrontFacetCatalog.NormalizeForMatch(
                    key == "color" ? StorefrontFacetCatalog.CanonicalizeColor(value) : value))))
            {
                return false;
            }
        }

        return true;
    }

    private static List<StorefrontCatalogProduct> ApplySort(
        List<StorefrontCatalogProduct> products,
        string? sort) => sort switch
    {
        "name" => products
            .OrderBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(p => p.Item.Id)
            .ToList(),
        "price_asc" => products
            .OrderBy(p => p.Price is null)
            .ThenBy(p => p.Price)
            .ThenBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList(),
        "price_desc" => products
            .OrderBy(p => p.Price is null)
            .ThenByDescending(p => p.Price)
            .ThenBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList(),
        "newest" => products
            .OrderByDescending(p => p.Item.CreatedAt)
            .ThenBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList(),
        "likes" => products
            .OrderByDescending(p => p.LikeCount)
            .ThenBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList(),
        _ => products
            .OrderByDescending(p => p.InStock)
            .ThenByDescending(p => p.Item.CreatedAt)
            .ThenBy(p => p.Item.Name, StringComparer.OrdinalIgnoreCase)
            .ToList(),
    };

    private static StorefrontProductListItemDto MapItem(StorefrontCatalogProduct product)
    {
        var item = product.Item;
        var fallbackImage = item.ResolvedThumbUrl is null
            ? CatalogItemThumbnailResolver.ResolveParentOrStandaloneImage(item, item.Variants)
            : null;
        var thumbUrl = item.ResolvedThumbUrl ?? fallbackImage?.ThumbUrl;
        var mediumUrl = item.ResolvedMediumUrl ?? fallbackImage?.MediumUrl;

        return new StorefrontProductListItemDto(
            item.Id,
            item.Kind,
            item.Name,
            item.Description,
            product.Price,
            product.OriginalPrice,
            product.DiscountPercent,
            thumbUrl,
            mediumUrl,
            product.InStock,
            item.Variants.Count > 0,
            item.Variants.Count,
            item.CreatedAt,
            ResolveSecondMediumUrl(item, mediumUrl),
            product.Colors,
            product.IsNew,
            product.LikeCount);
    }

    private static string? ResolveSecondMediumUrl(CatalogItem item, string? mainMediumUrl)
    {
        var modelSecond = item.Images
            .Where(i => i.GroupValue is null)
            .OrderBy(i => i.DisplayOrder)
            .Skip(1)
            .FirstOrDefault();
        if (modelSecond?.MediumUrl is not null && modelSecond.MediumUrl != mainMediumUrl)
        {
            return modelSecond.MediumUrl;
        }

        var otherParentImage = item.Images
            .OrderBy(i => i.DisplayOrder)
            .FirstOrDefault(i => i.MediumUrl != mainMediumUrl);
        if (otherParentImage?.MediumUrl is not null)
        {
            return otherParentImage.MediumUrl;
        }

        var variantImage = item.Variants
            .Where(v => v.DeletedAt == null)
            .OrderBy(v => v.SortOrder)
            .ThenBy(v => v.CreatedAt)
            .SelectMany(v => v.Images.OrderBy(img => img.DisplayOrder))
            .FirstOrDefault(img => img.MediumUrl != mainMediumUrl);

        return variantImage?.MediumUrl;
    }
}
