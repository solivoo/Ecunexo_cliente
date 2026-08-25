namespace EcuNexo.Business.Identity.Commands;

public sealed record CreateUserResponse(Guid UserId, Guid TenantId);
