using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Expenses.Queries.ListExpenseTypes;

public sealed record ListExpenseTypesQuery(
    Guid TenantId,
    bool? ActiveOnly) : IQuery<IReadOnlyList<ExpenseTypeResponse>>;
