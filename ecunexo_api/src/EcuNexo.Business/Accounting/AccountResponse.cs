using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting;

public sealed record AccountResponse(
    Guid Id,
    Guid TenantId,
    string Code,
    string Name,
    string Type,
    int TypeId,
    string Nature,
    int NatureId,
    int Level,
    Guid? ParentAccountId,
    string? ParentCode,
    bool AllowsMovement,
    bool IsSystem,
    bool IsActive,
    string? Description,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt)
{
    public static AccountResponse FromDomain(Account account) =>
        new(
            account.Id,
            account.TenantId,
            account.Code,
            account.Name,
            account.AccountType.ToString(),
            (int)account.AccountType,
            account.Nature.ToString(),
            (int)account.Nature,
            account.Level,
            account.ParentAccountId,
            account.ParentCode,
            account.AllowsMovement,
            account.IsSystem,
            account.IsActive,
            account.Description,
            account.CreatedAt,
            account.UpdatedAt);
}
