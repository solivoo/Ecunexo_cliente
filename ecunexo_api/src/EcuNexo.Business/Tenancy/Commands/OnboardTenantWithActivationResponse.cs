namespace EcuNexo.Business.Tenancy.Commands;

public sealed record OnboardTenantWithActivationResponse(
    Guid TenantId,
    Guid UserId,
    Guid RoleId);
