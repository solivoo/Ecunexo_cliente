namespace EcuNexo.Api.Contracts.V1.Auth;

public sealed record DevTokenRequest(Guid UserId, Guid? TenantId);
