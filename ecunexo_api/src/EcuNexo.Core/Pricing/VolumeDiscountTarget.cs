using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Objetivo de inclusión o exclusión de un esquema/regla de volumen.
/// </summary>
public sealed class VolumeDiscountTarget : Entity<Guid>, IAuditable
{
    public const int ReferenceMaxLength = 100;
    public const string AllItemsReference = "*";

    private VolumeDiscountTarget()
    {
        TargetReference = string.Empty;
    }

    public Guid VolumeDiscountSchemeId { get; private set; }

    public VolumeDiscountScheme? VolumeDiscountScheme { get; private set; }

    public VolumeRuleTargetType TargetType { get; private set; }

    public string TargetReference { get; private set; }

    public bool IsExclusion { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<VolumeDiscountTarget> Create(
        Guid id,
        Guid volumeDiscountSchemeId,
        VolumeRuleTargetType targetType,
        string targetReference,
        bool isExclusion = false,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || volumeDiscountSchemeId == Guid.Empty)
        {
            return Result.Failure<VolumeDiscountTarget>(
                new Error("catalog.pricing.volume_scheme.target.keys.invalid", "El identificador del objetivo y del esquema son obligatorios.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(targetType))
        {
            return Result.Failure<VolumeDiscountTarget>(
                new Error("catalog.pricing.volume_scheme.target.type.invalid", "El tipo de objetivo no es válido.", ErrorType.Validation));
        }

        var trimmed = targetType == VolumeRuleTargetType.AllItems
            ? AllItemsReference
            : targetReference?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return Result.Failure<VolumeDiscountTarget>(
                new Error("catalog.pricing.volume_scheme.target.reference.required", "La referencia del objetivo es obligatoria.", ErrorType.Validation));
        }

        if (trimmed.Length > ReferenceMaxLength)
        {
            return Result.Failure<VolumeDiscountTarget>(
                new Error("catalog.pricing.volume_scheme.target.reference.length", $"La referencia no puede superar {ReferenceMaxLength} caracteres.", ErrorType.Validation));
        }

        return new VolumeDiscountTarget
        {
            Id = id,
            VolumeDiscountSchemeId = volumeDiscountSchemeId,
            TargetType = targetType,
            TargetReference = trimmed,
            IsExclusion = isExclusion,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public bool Matches(Guid catalogItemId, Guid? parentId, Guid? categoryId)
    {
        return TargetType switch
        {
            VolumeRuleTargetType.AllItems => true,
            VolumeRuleTargetType.Category => categoryId.HasValue && string.Equals(TargetReference, categoryId.Value.ToString(), StringComparison.OrdinalIgnoreCase),
            VolumeRuleTargetType.Matrix => parentId.HasValue && string.Equals(TargetReference, parentId.Value.ToString(), StringComparison.OrdinalIgnoreCase),
            VolumeRuleTargetType.Product or VolumeRuleTargetType.Variant => string.Equals(TargetReference, catalogItemId.ToString(), StringComparison.OrdinalIgnoreCase),
            _ => false,
        };
    }
}
