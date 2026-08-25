namespace EcuNexo.Business.Identity.Queries.EvaluateAuthorization;

public sealed record EvaluateAuthorizationResponse(
    bool Granted,
    string? DeniedReason,
    IReadOnlyList<string> AllowedActions);
