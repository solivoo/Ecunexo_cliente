using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy;

public interface ISubscriptionAccountRepository
{
    Task<SubscriptionAccount?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<SubscriptionAccount?> GetByIdForUpdateAsync(Guid id, CancellationToken ct);

    Task<SubscriptionAccount?> GetByGrantIdAsync(Guid grantId, CancellationToken ct);

    Task<SubscriptionAccount?> GetByEmailForUpdateAsync(string email, CancellationToken ct);

    Task<SubscriptionAccount?> GetBySubscriptionGroupIdForUpdateAsync(Guid subscriptionGroupId, CancellationToken ct);

    Task<SubscriptionAccount?> GetBySubscriptionGroupIdAsync(Guid subscriptionGroupId, CancellationToken ct);

    Task<bool> EmailExistsAsync(string email, CancellationToken ct);

    Task<bool> AnyAsync(CancellationToken ct);

    Task AddAsync(SubscriptionAccount account, CancellationToken ct);
}
