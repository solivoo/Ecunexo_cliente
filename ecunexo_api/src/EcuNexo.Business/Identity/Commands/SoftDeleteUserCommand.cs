using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record SoftDeleteUserCommand(Guid TenantId, Guid UserId) : ICommand<SoftDeleteUserResponse>;

public sealed record SoftDeleteUserResponse(Guid UserId, Guid TenantId);
