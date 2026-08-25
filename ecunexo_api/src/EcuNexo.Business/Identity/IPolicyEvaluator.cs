using EcuNexo.Business.Identity.PolicyEvaluation;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity;

/// <summary>
/// Evalúa la expresión de condición ABAC almacenada en <see cref="EcuNexo.Core.Identity.Policy"/>.
/// Implementación por defecto: <see cref="EcuNexo.Business.Identity.PolicyEvaluation.DynamicExpressoPolicyEvaluator"/>.
/// </summary>
public interface IPolicyEvaluator
{
    /// <summary>
    /// Condición nula o en blanco: no hay restricción adicional (resultado <c>true</c>).
    /// </summary>
    Task<Result<bool>> EvaluateAsync(string? condition, PolicyEvaluationContext context, CancellationToken ct);

    /// <summary>
    /// Comprueba que la condición sea una expresión C# válida con resultado <see cref="bool"/>.
    /// Condición nula o en blanco: éxito inmediato.
    /// </summary>
    Task<Result> ValidateConditionSyntaxAsync(string? condition, CancellationToken ct);
}
