using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Condición ABAC sobre un <see cref="Permission"/> global: efecto (Allow/Deny) + expresión opcional.
/// </summary>
public sealed class Policy : Entity<Guid>, IAuditable
{
    public const int ConditionMaxLength = 8000;

    private Policy()
    {
        Permission = null!;
    }

    public Guid PermissionId { get; private set; }

    public Permission Permission { get; private set; }

    public PolicyEffect Effect { get; private set; }

    /// <summary>
    /// Expresión sobre sujeto/recurso (p. ej. DynamicExpresso). Null o vacío = sin condición adicional más allá del RBAC.
    /// </summary>
    public string? Condition { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<Policy> Create(Guid id, Guid permissionId, PolicyEffect effect, string? condition)
    {
        if (permissionId == Guid.Empty)
        {
            return Result.Failure<Policy>(
                new Error("policy.permission_id.invalid", "El permiso es obligatorio.", ErrorType.Validation));
        }

        string? normalized = null;
        if (condition is not null)
        {
            var c = condition.Trim();
            if (c.Length > ConditionMaxLength)
            {
                return Result.Failure<Policy>(
                    new Error(
                        "policy.condition.length",
                        $"La condición no puede superar {ConditionMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            normalized = c.Length == 0 ? null : c;
        }

        var policy = new Policy
        {
            Id = id,
            PermissionId = permissionId,
            Effect = effect,
            Condition = normalized,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return policy;
    }
}
