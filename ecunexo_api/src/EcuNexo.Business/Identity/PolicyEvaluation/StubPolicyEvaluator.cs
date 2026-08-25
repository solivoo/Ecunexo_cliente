using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.PolicyEvaluation;

/// <summary>
/// Sustituto para pruebas: rechaza cualquier condición no vacía en evaluación; validación de sintaxis delegable.
/// </summary>
public sealed class StubPolicyEvaluator : IPolicyEvaluator
{
    public Task<Result<bool>> EvaluateAsync(
        string? condition,
        PolicyEvaluationContext context,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(condition))
        {
            return Task.FromResult(Result.Success(true));
        }

        return Task.FromResult(Result.Failure<bool>(
            new Error(
                "policy.evaluator.not_implemented",
                "La evaluación de condiciones ABAC no está implementada. Use condición vacía o sustituya IPolicyEvaluator.",
                ErrorType.Unexpected)));
    }

    public Task<Result> ValidateConditionSyntaxAsync(string? condition, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(condition))
        {
            return Task.FromResult(Result.Success());
        }

        return Task.FromResult(Result.Failure(
            new Error(
                "policy.evaluator.stub_validate",
                "ValidateConditionSyntaxAsync no está disponible con StubPolicyEvaluator.",
                ErrorType.Unexpected)));
    }
}
