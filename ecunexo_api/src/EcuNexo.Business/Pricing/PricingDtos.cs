using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public sealed record PriceListResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    string Currency,
    bool PricesIncludeTax,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    int Priority,
    bool IsDefault,
    bool IsActive);

public sealed record ProductPriceFilter(
    Guid TenantId,
    string? Search,
    Guid? PriceListId,
    Guid? CategoryId,
    DateOnly? Date,
    bool OnlyVigent);

/// <summary>Proyección de consulta que une precio, lista e ítem de catálogo.</summary>
public sealed record ProductPriceListRow(
    Guid Id,
    Guid CatalogItemId,
    string ItemName,
    string? Sku,
    Guid? CategoryId,
    string? CategoryName,
    Guid PriceListId,
    string PriceListCode,
    string PriceListName,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    bool IsActive);

public sealed record ProductPriceListItemResponse(
    Guid Id,
    Guid CatalogItemId,
    string ItemName,
    string? Sku,
    Guid? CategoryId,
    string? CategoryName,
    Guid PriceListId,
    string PriceListCode,
    string PriceListName,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    bool IsActive);

public sealed record PriceTierInput(decimal QuantityFrom, decimal? QuantityTo, decimal UnitPrice);

public sealed record PriceTierResponse(decimal QuantityFrom, decimal? QuantityTo, decimal UnitPrice, bool IsActive);

public sealed record ProductPriceDetailResponse(
    Guid Id,
    Guid CatalogItemId,
    string ItemName,
    string? Sku,
    Guid PriceListId,
    string PriceListCode,
    string PriceListName,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    bool IsActive,
    IReadOnlyList<PriceTierResponse> Tiers);

/// <summary>Proyección de historial con nombres de producto y lista.</summary>
public sealed record PriceHistoryRow(
    Guid Id,
    Guid CatalogItemId,
    string ItemName,
    string? Sku,
    Guid PriceListId,
    string PriceListCode,
    string PriceListName,
    decimal? PreviousPrice,
    decimal? NewPrice,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    Guid? ChangedBy,
    DateTimeOffset ChangedAt);

public sealed record PriceHistoryItemResponse(
    Guid Id,
    Guid CatalogItemId,
    string ItemName,
    string? Sku,
    Guid PriceListId,
    string PriceListCode,
    string PriceListName,
    decimal? PreviousPrice,
    decimal? NewPrice,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    Guid? ChangedBy,
    DateTimeOffset ChangedAt);

public sealed record PromotionTargetInput(PromotionTargetType TargetType, string TargetReference);

public sealed record PromotionTargetResponse(PromotionTargetType TargetType, string TargetReference);

public sealed record PromotionResponse(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    int Priority,
    bool IsStackable,
    bool IsActive,
    IReadOnlyList<PromotionTargetResponse> Targets);
