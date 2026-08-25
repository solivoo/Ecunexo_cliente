namespace EcuNexo.Api.Contracts.V1.Auth;

public sealed record LoginRequest(Guid? TenantId, string Email, string Password);
