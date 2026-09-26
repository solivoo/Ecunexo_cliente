using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Alcance de una promoción. El tipo y la referencia permiten productos, variantes, categorías y
/// futuros segmentos (marca, cliente, canal) sin rediseñar la promoción.
/// </summary>
public sealed class PromotionTarget : Entity<Guid>, IAuditable
{
    public const int ReferenceMaxLength = 100;

    private PromotionTarget()
    {
        TargetReference = string.Empty;
    }

    public Guid PromotionId { get; private set; }

    public Promotion? Promotion { get; private set; }

    public PromotionTargetType TargetType { get; private set; }

    /// <summary>Identificador del objetivo (Guid en texto para ítem/variante/categoría).</summary>
    public string TargetReference { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<PromotionTarget> Create(
        Guid id,
        Guid promotionId,
        PromotionTargetType targetType,
        string targetReference,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || promotionId == Guid.Empty)
        {
            return Result.Failure<PromotionTarget>(
                new Error("catalog.pricing.promotion.target.keys.invalid", "El identificador del alcance y de la promoción son obligatorios.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(targetType))
        {
            return Result.Failure<PromotionTarget>(
                new Error("catalog.pricing.promotion.target.type.invalid", "El tipo de alcance no es válido.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(targetReference))
        {
            return Result.Failure<PromotionTarget>(
                new Error("catalog.pricing.promotion.target.required", "La referencia del alcance es obligatoria.", ErrorType.Validation));
        }

        var reference = targetReference.Trim();
        if (reference.Length > ReferenceMaxLength)
        {
            return Result.Failure<PromotionTarget>(
                new Error("catalog.pricing.promotion.target.length", $"La referencia no puede superar {ReferenceMaxLength} caracteres.", ErrorType.Validation));
        }

        return new PromotionTarget
        {
            Id = id,
            PromotionId = promotionId,
            TargetType = targetType,
            TargetReference = reference,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    /// <summary>True cuando el alcance coincide con el objetivo consultado.</summary>
    public bool Matches(PromotionTargetType targetType, string targetReference) =>
        TargetType == targetType
        && string.Equals(TargetReference, targetReference.Trim(), StringComparison.OrdinalIgnoreCase);
}
