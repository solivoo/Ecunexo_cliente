using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Repositories;

public interface IEcommerceBlockedContactRepository
{
    Task<bool> ExistsAsync(
        Guid tenantId,
        EcommerceBlockedContactKind kind,
        string valueNormalized,
        CancellationToken ct = default);

    Task<IReadOnlyList<EcommerceBlockedContact>> ListAsync(
        Guid tenantId,
        CancellationToken ct = default);

    Task<EcommerceBlockedContact?> GetByIdAsync(
        Guid tenantId,
        Guid contactId,
        CancellationToken ct = default);

    Task AddAsync(EcommerceBlockedContact contact, CancellationToken ct = default);

    void Remove(EcommerceBlockedContact contact);
}
