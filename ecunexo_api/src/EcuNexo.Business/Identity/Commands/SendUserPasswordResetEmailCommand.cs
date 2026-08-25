using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Identity.Commands;

public sealed record SendUserPasswordResetEmailCommand(Guid TenantId, Guid UserId)
    : ICommand<SendUserPasswordResetEmailResponse>;

public sealed record SendUserPasswordResetEmailResponse(Guid UserId, Guid TenantId, string Email);
