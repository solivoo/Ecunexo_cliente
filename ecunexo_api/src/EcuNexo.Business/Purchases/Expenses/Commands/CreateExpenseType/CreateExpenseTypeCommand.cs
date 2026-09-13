using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Expenses.Commands.CreateExpenseType;

public sealed record CreateExpenseTypeCommand(
    Guid TenantId,
    string Code,
    string Name,
    string SriSustentoCode = "01",
    bool AffectsInventory = false,
    string? SuggestedRetentionCode = null,
    string? Description = null,
    Guid? CreatedBy = null) : ICommand<ExpenseTypeResponse>;
