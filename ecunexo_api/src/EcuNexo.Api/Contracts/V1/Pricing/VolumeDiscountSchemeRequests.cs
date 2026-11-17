using EcuNexo.Core.Pricing;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record VolumeDiscountTierRequest(decimal QuantityFrom, decimal? QuantityTo, decimal Value);

public sealed record VolumeDiscountTargetRequest(
    VolumeRuleTargetType TargetType,
    string TargetReference,
    bool IsExclusion = false);

public sealed record CreateVolumeDiscountSchemeRequest(
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    IReadOnlyList<VolumeDiscountTierRequest>? Tiers,
    VolumeGroupingMode GroupingMode = VolumeGroupingMode.PerLine,
    decimal? MinGroupQuantity = null,
    bool EnforceMinPurchase = false,
    int Priority = 0,
    IReadOnlyList<VolumeDiscountTargetRequest>? Targets = null);

public sealed record UpdateVolumeDiscountSchemeRequest(
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    bool? IsActive,
    IReadOnlyList<VolumeDiscountTierRequest>? Tiers,
    VolumeGroupingMode? GroupingMode = null,
    decimal? MinGroupQuantity = null,
    bool? EnforceMinPurchase = null,
    int? Priority = null,
    IReadOnlyList<VolumeDiscountTargetRequest>? Targets = null);

public sealed record AssignVolumeDiscountSchemeRequest(
    Guid PriceListId,
    Guid? VolumeDiscountSchemeId,
    IReadOnlyList<Guid> CatalogItemIds);
