using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;

public sealed class GetStorefrontProductHandler
    : IQueryHandler<GetStorefrontProductQuery, StorefrontProductDetailDto>
{
    private readonly ISender _sender;
    private readonly IStockRepository _stock;
    private readonly ITenantRepository _tenants;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;

    public GetStorefrontProductHandler(
        ISender sender,
        IStockRepository stock,
        ITenantRepository tenants,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices)
    {
        _sender = sender;
        _stock = stock;
        _tenants = tenants;
        _priceLists = priceLists;
        _productPrices = productPrices;
    }

    public async Task<Result<StorefrontProductDetailDto>> Handle(
        GetStorefrontProductQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontProductDetailDto>(tenantError);
        }

        var detailResult = await _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                new GetCatalogItemQuery(query.TenantId, query.ProductId),
                ct)
            .ConfigureAwait(false);

        if (detailResult.IsFailure
            || detailResult.Value!.Status != CatalogItemStatus.Active
            || detailResult.Value.Kind != CatalogItemKind.Physical)
        {
            return Result.Failure<StorefrontProductDetailDto>(StorefrontTenantGuard.ProductNotFound);
        }

        var item = detailResult.Value!;
        var variants = item.Variants ?? [];

        var ids = new HashSet<Guid> { item.Id };
        foreach (var variant in variants)
        {
            ids.Add(variant.Id);
        }

        var availability = await _stock
            .SumAvailableByItemIdsAsync(query.TenantId, ids, ct)
            .ConfigureAwait(false);

        var totalAvailable = SumAvailability(item.Id, variants, availability);

        var defaultList = await _priceLists.GetDefaultAsync(query.TenantId, ct).ConfigureAwait(false);
        var priceIds = new List<Guid> { item.Id };
        if (item.ParentId is { } parentIdForPrice)
        {
            priceIds.Add(parentIdForPrice);
        }

        foreach (var variant in variants)
        {
            priceIds.Add(variant.Id);
        }

        var resolvedPrices = defaultList is null
            ? new Dictionary<Guid, decimal>()
            : await _productPrices
                .ListVigentByItemIdsAsync(
                    query.TenantId,
                    defaultList.Id,
                    priceIds,
                    DateOnly.FromDateTime(DateTime.UtcNow),
                    ct)
                .ConfigureAwait(false);

        var parentPrice = item.ParentId is { } parentId
            ? ResolvePrice(resolvedPrices, parentId)
            : null;
        var productPrice = ResolvePrice(resolvedPrices, item.Id) ?? parentPrice ?? item.BasePrice;

        var variantDtos = variants
            .Select(variant => MapVariant(
                variant,
                availability,
                ResolvePrice(resolvedPrices, variant.Id) ?? productPrice))
            .ToList();

        var dto = new StorefrontProductDetailDto(
            item.Id,
            item.Kind,
            item.Name,
            item.Sku,
            item.Description,
            productPrice,
            totalAvailable > 0m,
            totalAvailable,
            item.Images.Select(MapImage).ToList(),
            variantDtos,
            MapMatrix(item.MatrixDescriptor),
            ParseAttributes(item.HierarchyPathJson, item.CustomAttributesJson),
            item.CreatedAt,
            item.UpdatedAt);

        return Result.Success(dto);
    }

    private static decimal SumAvailability(
        Guid itemId,
        IReadOnlyList<CatalogItemVariantDto> variants,
        IReadOnlyDictionary<Guid, decimal> availability)
    {
        var total = availability.TryGetValue(itemId, out var own) ? own : 0m;
        foreach (var variant in variants)
        {
            if (availability.TryGetValue(variant.Id, out var available))
            {
                total += available;
            }
        }

        return total;
    }

    private static decimal? ResolvePrice(
        IReadOnlyDictionary<Guid, decimal> prices,
        Guid catalogItemId) =>
        prices.TryGetValue(catalogItemId, out var price) ? price : null;

    private static StorefrontVariantDto MapVariant(
        CatalogItemVariantDto variant,
        IReadOnlyDictionary<Guid, decimal> availability,
        decimal? price)
    {
        var available = availability.TryGetValue(variant.Id, out var value) ? value : 0m;
        var gallery = variant.Images?.Select(MapImage).ToList();
        var mainGalleryImage = variant.Images is { Count: > 0 } variantImages
            ? variantImages.FirstOrDefault(i => i.IsMain) ?? variantImages[0]
            : null;

        return new StorefrontVariantDto(
            variant.Id,
            variant.Name,
            variant.Sku,
            price,
            available > 0m,
            available,
            variant.DimensionValues,
            variant.MainImageThumbUrl,
            mainGalleryImage?.MediumUrl ?? variant.MainImageThumbUrl,
            variant.ImageInherited,
            variant.ImageInheritedFrom,
            gallery,
            variant.ExtraColors);
    }

    private static StorefrontImageDto MapImage(CatalogItemImageResponse image) =>
        new(
            image.Id,
            image.AltText,
            image.IsMain,
            image.ThumbUrl,
            image.MediumUrl,
            image.LargeUrl);

    private static StorefrontMatrixDto? MapMatrix(CatalogMatrixDescriptorDto? matrix)
    {
        if (matrix is null)
        {
            return null;
        }

        return new StorefrontMatrixDto(
            matrix.Depth,
            matrix.PrimaryAxis,
            matrix.Axes
                .Select(axis => new StorefrontMatrixAxisDto(
                    axis.Name,
                    axis.Type,
                    axis.Values,
                    axis.IsPhotoGroup))
                .ToList(),
            matrix.GroupValues);
    }

    private static readonly string[] InternalAttributeKeys =
        ["parent_reassignment_history", "tags", "colores_secundarios", "barcode", "ean"];

    private static List<StorefrontAttributeDto> ParseAttributes(
        string? hierarchyPathJson,
        string? customAttributesJson)
    {
        var attributes = new List<StorefrontAttributeDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var attribute in ParseHierarchyPath(hierarchyPathJson))
        {
            attributes.Add(attribute);
            seen.Add(attribute.Name);
        }

        if (string.IsNullOrWhiteSpace(customAttributesJson))
        {
            return attributes;
        }

        try
        {
            using var doc = JsonDocument.Parse(customAttributesJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return attributes;
            }

            foreach (var property in doc.RootElement.EnumerateObject())
            {
                if (InternalAttributeKeys.Contains(property.Name, StringComparer.OrdinalIgnoreCase)
                    || seen.Contains(property.Name))
                {
                    continue;
                }

                var value = FormatAttributeValue(property.Value);
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                attributes.Add(new StorefrontAttributeDto(
                    "Ficha",
                    Capitalize(property.Name),
                    value));
            }
        }
        catch (JsonException)
        {
            return attributes;
        }

        return attributes;
    }

    private static IReadOnlyList<StorefrontAttributeDto> ParseHierarchyPath(string? hierarchyPathJson)
    {
        if (string.IsNullOrWhiteSpace(hierarchyPathJson))
        {
            return Array.Empty<StorefrontAttributeDto>();
        }

        try
        {
            using var doc = JsonDocument.Parse(hierarchyPathJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Array.Empty<StorefrontAttributeDto>();
            }

            var attributes = new List<StorefrontAttributeDto>();
            foreach (var entry in doc.RootElement.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var level = entry.TryGetProperty("level", out var levelElement)
                    && levelElement.ValueKind == JsonValueKind.String
                        ? levelElement.GetString()
                        : null;
                var name = entry.TryGetProperty("name", out var nameElement)
                    && nameElement.ValueKind == JsonValueKind.String
                        ? nameElement.GetString()
                        : null;
                var value = entry.TryGetProperty("value", out var valueElement)
                    && valueElement.ValueKind == JsonValueKind.String
                        ? valueElement.GetString()
                        : null;

                if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                attributes.Add(new StorefrontAttributeDto(level ?? name!, name!, value!));
            }

            return attributes;
        }
        catch (JsonException)
        {
            return Array.Empty<StorefrontAttributeDto>();
        }
    }

    private static string? FormatAttributeValue(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString()?.Trim(),
        JsonValueKind.Number => element.GetRawText(),
        JsonValueKind.True => "Sí",
        JsonValueKind.False => "No",
        JsonValueKind.Array => string.Join(
            ", ",
            element.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String)
                .Select(item => item.GetString()!.Trim())
                .Where(item => item.Length > 0)),
        _ => null,
    };

    private static string Capitalize(string value) =>
        string.IsNullOrEmpty(value)
            ? value
            : char.ToUpperInvariant(value[0]) + value[1..];
}
