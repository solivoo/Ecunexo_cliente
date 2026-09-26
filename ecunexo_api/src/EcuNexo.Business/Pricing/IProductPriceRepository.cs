using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing;

public interface IProductPriceRepository
{
    Task AddAsync(ProductPrice price, CancellationToken ct);

    Task<ProductPrice?> GetByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct);

    Task<ProductPrice?> GetTrackedByIdAsync(Guid tenantId, Guid productPriceId, CancellationToken ct);

    Task<ProductPrice?> GetVigentAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly date,
        CancellationToken ct);

    Task<ProductPrice?> GetOverlappingTrackedAsync(
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid? excludeId,
        CancellationToken ct);

    Task<IReadOnlyDictionary<Guid, decimal>> ListVigentByItemIdsAsync(
        Guid tenantId,
        Guid priceListId,
        IReadOnlyCollection<Guid> catalogItemIds,
        DateOnly date,
        CancellationToken ct);

    Task<IReadOnlyList<ProductPriceListRow>> ListAsync(ProductPriceFilter filter, CancellationToken ct);
}
