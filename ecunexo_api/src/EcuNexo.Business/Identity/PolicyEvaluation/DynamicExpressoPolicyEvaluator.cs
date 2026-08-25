using DynamicExpresso;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.PolicyEvaluation;

/// <summary>
/// Evalúa <c>Policy.Condition</c> como expresión C# que devuelve <see cref="bool"/>.
/// La variable <c>ctx</c> es de tipo <see cref="PolicyEvaluationContext"/> (p. ej. <c>ctx.TenantId != null</c>).
/// </summary>
public sealed class DynamicExpressoPolicyEvaluator : IPolicyEvaluator
{
    public Task<Result<bool>> EvaluateAsync(
        string? condition,
        PolicyEvaluationContext context,
        CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(condition))
        {
            return Task.FromResult(Result.Success(true));
        }

        try
        {
            var interpreter = CreateInterpreter(context);
            var lambda = interpreter.Parse(condition.Trim(), typeof(bool));
            var value = lambda.Invoke();
            return Task.FromResult(Result.Success((bool)value!));
        }
        catch (Exception ex)
        {
            return Task.FromResult(Result.Failure<bool>(new Error(
                "policy.evaluator.failed",
                ex.Message,
                ErrorType.Unexpected)));
        }
    }

    public Task<Result> ValidateConditionSyntaxAsync(string? condition, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(condition))
        {
            return Task.FromResult(Result.Success());
        }

        try
        {
            var interpreter = CreateInterpreter(PolicyEvaluationContext.ForSyntaxCheck());
            interpreter.Parse(condition.Trim(), typeof(bool));
            return Task.FromResult(Result.Success());
        }
        catch (Exception ex)
        {
            return Task.FromResult(Result.Failure(new Error(
                "policy.condition.syntax",
                $"Expresión inválida: {ex.Message}",
                ErrorType.Validation)));
        }
    }

    private static Interpreter CreateInterpreter(PolicyEvaluationContext context)
    {
        var interpreter = new Interpreter();
        interpreter.SetVariable("ctx", context);
        return interpreter;
    }
}
