using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Expenses.Queries.ListExpenseTypes;

public sealed class ListExpenseTypesHandler : IQueryHandler<ListExpenseTypesQuery, IReadOnlyList<ExpenseTypeResponse>>
{
    private readonly IExpenseTypeRepository _expenseTypes;

    public ListExpenseTypesHandler(IExpenseTypeRepository expenseTypes)
    {
        _expenseTypes = expenseTypes;
    }

    public async Task<Result<IReadOnlyList<ExpenseTypeResponse>>> Handle(ListExpenseTypesQuery query, CancellationToken ct)
    {
        var list = await _expenseTypes.ListAsync(query.TenantId, query.ActiveOnly, ct).ConfigureAwait(false);
        IReadOnlyList<ExpenseTypeResponse> result = list.Select(ExpenseTypeResponse.FromDomain).ToList();
        return Result.Success(result);
    }
}
