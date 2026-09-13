using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType;

public sealed record DeleteExpenseTypeCommand(
    Guid TenantId,
    Guid ExpenseTypeId,
    Guid? DeletedBy = null) : ICommand<bool>;
