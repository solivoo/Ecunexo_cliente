namespace EcuNexo.Api.Contracts.V1.Identity;

public sealed record EvaluateAuthorizationRequest(
    string Permission,
    string? ResourceType = null,
    Guid? ResourceId = null);
