using EcuNexo.Business.Identity.PolicyEvaluation;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Authorization;

/// <summary>
/// Comprueba RBAC + políticas ABAC con efecto <c>Deny</c> asociadas al permiso (acoplamiento HTTP en la capa Api).
/// </summary>
public interface IPermissionAccessGuard
{
    /// <summary>
    /// <paramref name="permissionCode"/> sin normalizar: se aplica <c>Trim</c> y minúsculas como en el dominio.
    /// </summary>
    Task<Result> RequireAsync(string permissionCode, PolicyEvaluationContext evaluationContext, CancellationToken ct);
}
