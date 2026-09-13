using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Repositories;

public interface IExpenseTypeRepository
{
    Task AddAsync(ExpenseType expenseType, CancellationToken ct);
    Task AddRangeAsync(IEnumerable<ExpenseType> expenseTypes, CancellationToken ct);
    Task<ExpenseType?> GetByIdAsync(Guid tenantId, Guid expenseTypeId, CancellationToken ct);
    Task<ExpenseType?> GetTrackedByIdAsync(Guid tenantId, Guid expenseTypeId, CancellationToken ct);
    Task<IReadOnlyList<ExpenseType>> ListAsync(Guid tenantId, bool? activeOnly, CancellationToken ct);
    Task<bool> ExistsByCodeAsync(Guid tenantId, string code, Guid? excludeId, CancellationToken ct);
    Task<int> CountAsync(Guid tenantId, CancellationToken ct);
}
