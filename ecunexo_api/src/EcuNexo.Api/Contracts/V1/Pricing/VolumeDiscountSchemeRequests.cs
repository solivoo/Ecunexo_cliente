using EcuNexo.Core.Pricing;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record VolumeDiscountTierRequest(decimal QuantityFrom, decimal? QuantityTo, decimal Value);

public sealed record CreateVolumeDiscountSchemeRequest(
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    IReadOnlyList<VolumeDiscountTierRequest>? Tiers);

public sealed record UpdateVolumeDiscountSchemeRequest(
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    bool? IsActive,
    IReadOnlyList<VolumeDiscountTierRequest>? Tiers);

public sealed record AssignVolumeDiscountSchemeRequest(
    Guid PriceListId,
    Guid? VolumeDiscountSchemeId,
    IReadOnlyList<Guid> CatalogItemIds);
