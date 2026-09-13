using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Accounting.Commands.DeleteAccount;

public sealed record DeleteAccountCommand(
    Guid TenantId,
    Guid AccountId,
    Guid? UserId = null) : ICommand<bool>;
