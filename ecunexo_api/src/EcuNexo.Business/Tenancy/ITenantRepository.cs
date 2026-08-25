using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy;

/// <summary>
/// Persistence port for <see cref="Tenant"/> aggregate — implemented in <c>EcuNexo.Data</c>.
/// </summary>
public interface ITenantRepository
{
    Task<bool> ExistsByIdAsync(Guid id, CancellationToken ct);

    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<Tenant?> GetByIdForUpdateAsync(Guid id, CancellationToken ct);

    Task<IReadOnlyList<Tenant>> ListBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct);

    Task<IReadOnlyList<Tenant>> ListBySubscriptionGroupIdForUpdateAsync(Guid subscriptionGroupId, CancellationToken ct);

    Task<int> CountBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct);

    Task AddAsync(Tenant tenant, CancellationToken ct);
}
