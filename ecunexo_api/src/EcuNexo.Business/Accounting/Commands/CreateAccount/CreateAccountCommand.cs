using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting.Commands.CreateAccount;

public sealed record CreateAccountCommand(
    Guid TenantId,
    string Code,
    string Name,
    AccountType? AccountType = null,
    AccountNature? Nature = null,
    Guid? ParentAccountId = null,
    string? ParentCode = null,
    bool AllowsMovement = true,
    string? Description = null,
    Guid? UserId = null) : ICommand<AccountResponse>;
