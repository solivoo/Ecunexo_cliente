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
    bool IsActive,
    decimal? SuggestedMarginPercent = null);

public sealed record ProductPriceFilter(
    Guid TenantId,
    string? Search,
    Guid? PriceListId,
    DateOnly? Date,
    bool OnlyVigent,
    Guid? CatalogItemId = null);

/// <summary>Proyección de consulta que une precio, lista e ítem de catálogo.</summary>
public sealed record ProductPriceListRow(
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
    Guid? VolumeDiscountSchemeId = null,
    string? VolumeDiscountSchemeName = null,
    decimal? AverageCost = null,
    bool PricesIncludeTax = false);

public sealed record ProductPriceListItemResponse(
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
    Guid? VolumeDiscountSchemeId = null,
    string? VolumeDiscountSchemeName = null,
    decimal? AverageCost = null,
    bool PricesIncludeTax = false);

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
    IReadOnlyList<PriceTierResponse> Tiers,
    Guid? VolumeDiscountSchemeId = null,
    string? VolumeDiscountSchemeName = null,
    decimal? AverageCost = null,
    bool PricesIncludeTax = false);

public sealed record VolumeDiscountTierInput(decimal QuantityFrom, decimal? QuantityTo, decimal Value);

public sealed record VolumeDiscountTargetInput(
    VolumeRuleTargetType TargetType,
    string TargetReference,
    bool IsExclusion = false);

public sealed record VolumeDiscountTierResponse(
    Guid Id,
    decimal QuantityFrom,
    decimal? QuantityTo,
    decimal Value,
    bool IsActive);

public sealed record VolumeDiscountTargetResponse(
    Guid Id,
    VolumeRuleTargetType TargetType,
    string TargetReference,
    bool IsExclusion);

public sealed record VolumeDiscountSchemeResponse(
    Guid Id,
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    bool IsActive,
    IReadOnlyList<VolumeDiscountTierResponse> Tiers,
    VolumeGroupingMode GroupingMode = VolumeGroupingMode.PerLine,
    decimal? MinGroupQuantity = null,
    bool EnforceMinPurchase = false,
    int Priority = 0,
    IReadOnlyList<VolumeDiscountTargetResponse>? Targets = null);

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
    IReadOnlyList<PromotionTargetResponse> Targets,
    bool RequiresCode = false,
    decimal? MinOrderAmount = null,
    int? UsageLimit = null,
    int TimesUsed = 0);

public sealed record ProductPriceMatrixFilter(
    Guid TenantId,
    int Page,
    int PageSize,
    string? Search,
    bool OnlyMissing,
    IReadOnlyCollection<Guid>? PriceListIds,
    DateOnly Date);

public sealed record ProductPriceMatrixCellResponse(
    Guid PriceId,
    decimal Price,
    DateOnly ValidFrom,
    Guid? VolumeDiscountSchemeId = null,
    string? VolumeDiscountSchemeName = null);

public sealed record ProductPriceMatrixRowResponse(
    Guid CatalogItemId,
    string Name,
    string? Sku,
    EcuNexo.Core.Catalog.CatalogItemKind Kind,
    decimal? ReferenceCost,
    string? CostSource,
    Guid? VolumeDiscountSchemeId,
    string? VolumeDiscountSchemeName,
    IReadOnlyDictionary<Guid, ProductPriceMatrixCellResponse> Cells);

public sealed record ProductPriceMatrixPageResponse(
    IReadOnlyList<PriceListResponse> PriceLists,
    IReadOnlyList<ProductPriceMatrixRowResponse> Items,
    int TotalCount,
    int TotalSellableItems,
    int ItemsMissingAnyPrice,
    int Page,
    int PageSize);
