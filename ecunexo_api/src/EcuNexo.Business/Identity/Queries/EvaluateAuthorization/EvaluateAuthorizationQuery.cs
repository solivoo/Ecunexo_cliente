using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.PolicyEvaluation;

namespace EcuNexo.Business.Identity.Queries.EvaluateAuthorization;

public sealed record EvaluateAuthorizationQuery(
    Guid TenantId,
    Guid UserId,
    string Permission,
    PolicyEvaluationContext EvaluationContext) : IQuery<EvaluateAuthorizationResponse>;
