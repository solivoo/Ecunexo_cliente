using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record SetUserDisabledCommand(
    Guid TenantId,
    Guid UserId,
    bool Disabled) : ICommand<SetUserDisabledResponse>;

public sealed record SetUserDisabledResponse(Guid UserId, Guid TenantId, bool IsDisabled);
