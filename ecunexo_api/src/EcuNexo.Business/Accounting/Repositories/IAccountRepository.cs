using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting.Repositories;

public interface IAccountRepository
{
    Task AddAsync(Account account, CancellationToken ct);
    Task AddRangeAsync(IEnumerable<Account> accounts, CancellationToken ct);
    Task<Account?> GetByIdAsync(Guid tenantId, Guid accountId, CancellationToken ct);
    Task<Account?> GetTrackedByIdAsync(Guid tenantId, Guid accountId, CancellationToken ct);
    Task<Account?> GetByCodeAsync(Guid tenantId, string code, CancellationToken ct);
    Task<IReadOnlyList<Account>> ListAsync(
        Guid tenantId,
        AccountType? type,
        bool? allowsMovementOnly,
        bool? activeOnly,
        string? search,
        CancellationToken ct);
    Task<bool> ExistsByCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);
    Task<int> CountAsync(Guid tenantId, CancellationToken ct);
}
