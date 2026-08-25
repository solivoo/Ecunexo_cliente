using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record SetUserPasswordCommand(
    Guid TenantId,
    Guid UserId,
    string Password) : ICommand<SetUserPasswordResponse>;

public sealed record SetUserPasswordResponse(Guid UserId, Guid TenantId);
