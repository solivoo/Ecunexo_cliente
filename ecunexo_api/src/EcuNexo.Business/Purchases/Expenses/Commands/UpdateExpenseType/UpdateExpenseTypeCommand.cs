using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType;

public sealed record UpdateExpenseTypeCommand(
    Guid TenantId,
    Guid ExpenseTypeId,
    string Name,
    string SriSustentoCode = "01",
    bool AffectsInventory = false,
    string? SuggestedRetentionCode = null,
    decimal? RetentionPercentage = null,
    DateOnly? ValidFrom = null,
    DateOnly? ValidUntil = null,
    string? Description = null,
    string? Code = null,
    bool? IsActive = null,
    Guid? UpdatedBy = null) : ICommand<ExpenseTypeResponse>;
