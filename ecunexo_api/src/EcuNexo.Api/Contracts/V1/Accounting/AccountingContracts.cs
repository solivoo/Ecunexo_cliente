using EcuNexo.Core.Accounting;

namespace EcuNexo.Api.Contracts.V1.Accounting;

public sealed record CreateAccountApiRequest(
    string Code,
    string Name,
    AccountType? AccountType = null,
    AccountNature? Nature = null,
    Guid? ParentAccountId = null,
    string? ParentCode = null,
    bool AllowsMovement = true,
    string? Description = null);

public sealed record UpdateAccountApiRequest(
    string Name,
    string? Description,
    bool AllowsMovement,
    bool IsActive,
    AccountNature? Nature = null);
