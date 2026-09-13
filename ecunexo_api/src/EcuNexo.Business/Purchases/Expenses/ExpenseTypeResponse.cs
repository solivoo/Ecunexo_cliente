using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Expenses;

public sealed record ExpenseTypeResponse(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    string SriSustentoCode,
    string? Description,
    bool AffectsInventory,
    bool IsSystem,
    string? SuggestedRetentionCode,
    decimal? RetentionPercentage,
    DateOnly? ValidFrom,
    DateOnly? ValidUntil,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt)
{
    public static ExpenseTypeResponse FromDomain(ExpenseType e) => new(
        e.Id,
        e.TenantId,
        e.Code,
        e.Name,
        e.SriSustentoCode,
        e.Description,
        e.AffectsInventory,
        e.IsSystem,
        e.SuggestedRetentionCode,
        e.RetentionPercentage,
        e.ValidFrom,
        e.ValidUntil,
        e.IsActive,
        e.CreatedAt,
        e.UpdatedAt);
}
