using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting.Commands.UpdateAccount;

public sealed record UpdateAccountCommand(
    Guid TenantId,
    Guid AccountId,
    string Name,
    string? Description,
    bool AllowsMovement,
    bool IsActive,
    AccountNature? Nature = null,
    Guid? UserId = null) : ICommand<AccountResponse>;
