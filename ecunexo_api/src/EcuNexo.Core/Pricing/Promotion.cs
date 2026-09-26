using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Promoción comercial temporal. Nunca modifica el precio de lista; el motor la aplica como
/// descuento o precio promocional según su prioridad y acumulabilidad.
/// </summary>
public sealed class Promotion : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int CodeMaxLength = 40;
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 300;

    private readonly List<PromotionTarget> _targets = [];

    private Promotion()
    {
        Code = string.Empty;
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public PromotionType Type { get; private set; }

    /// <summary>Porcentaje (0-100) o valor monetario según el tipo.</summary>
    public decimal Value { get; private set; }

    public DateTimeOffset StartsAt { get; private set; }

    public DateTimeOffset? EndsAt { get; private set; }

    /// <summary>Mayor prioridad gana ante conflicto de reglas.</summary>
    public int Priority { get; private set; }

    /// <summary>True cuando puede combinarse con otras promociones acumulables.</summary>
    public bool IsStackable { get; private set; }

    public bool IsActive { get; private set; }

    public IReadOnlyList<PromotionTarget> Targets => _targets.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<Promotion> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description,
        PromotionType type,
        decimal value,
        DateTimeOffset startsAt,
        DateTimeOffset? endsAt,
        int priority,
        bool isStackable,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<Promotion>(
                new Error("catalog.pricing.promotion.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var codeResult = NormalizeCode(code);
        if (codeResult.IsFailure)
        {
            return Result.Failure<Promotion>(codeResult.Error!);
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<Promotion>(nameResult.Error!);
        }

        var descriptionResult = NormalizeDescription(description);
        if (descriptionResult.IsFailure)
        {
            return Result.Failure<Promotion>(descriptionResult.Error!);
        }

        var validation = Validate(type, value, startsAt, endsAt);
        if (validation.IsFailure)
        {
            return Result.Failure<Promotion>(validation.Error!);
        }

        return new Promotion
        {
            Id = id,
            TenantId = tenantId,
            Code = codeResult.Value!,
            Name = nameResult.Value!,
            Description = descriptionResult.Value,
            Type = type,
            Value = decimal.Round(value, 6, MidpointRounding.AwayFromZero),
            StartsAt = startsAt,
            EndsAt = endsAt,
            Priority = priority,
            IsStackable = isStackable,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        string name,
        string? description,
        PromotionType type,
        decimal value,
        DateTimeOffset startsAt,
        DateTimeOffset? endsAt,
        int priority,
        bool isStackable,
        Guid? updatedBy = null)
    {
        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure(nameResult.Error!);
        }

        var descriptionResult = NormalizeDescription(description);
        if (descriptionResult.IsFailure)
        {
            return Result.Failure(descriptionResult.Error!);
        }

        var validation = Validate(type, value, startsAt, endsAt);
        if (validation.IsFailure)
        {
            return validation;
        }

        Name = nameResult.Value!;
        Description = descriptionResult.Value;
        Type = type;
        Value = decimal.Round(value, 6, MidpointRounding.AwayFromZero);
        StartsAt = startsAt;
        EndsAt = endsAt;
        Priority = priority;
        IsStackable = isStackable;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result<PromotionTarget> AddTarget(
        Guid targetId,
        PromotionTargetType targetType,
        string targetReference,
        Guid? createdBy = null)
    {
        var exists = _targets.Any(t =>
            t.TargetType == targetType
            && string.Equals(t.TargetReference, targetReference.Trim(), StringComparison.OrdinalIgnoreCase));
        if (exists)
        {
            return Result.Failure<PromotionTarget>(
                new Error("catalog.pricing.promotion.target.duplicate", "El alcance ya está asignado a esta promoción.", ErrorType.Conflict));
        }

        var targetResult = PromotionTarget.Create(targetId, Id, targetType, targetReference, createdBy);
        if (targetResult.IsFailure)
        {
            return Result.Failure<PromotionTarget>(targetResult.Error!);
        }

        _targets.Add(targetResult.Value!);
        Touch(createdBy);
        return Result.Success(targetResult.Value!);
    }

    public Result RemoveTarget(Guid targetId, Guid? updatedBy = null)
    {
        var target = _targets.FirstOrDefault(t => t.Id == targetId);
        if (target is null)
        {
            return Result.Failure(
                new Error("catalog.pricing.promotion.target.not_found", "El alcance indicado no existe en esta promoción.", ErrorType.NotFound));
        }

        _targets.Remove(target);
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>True cuando la promoción está activa y su ventana de vigencia contiene el momento indicado.</summary>
    public bool IsApplicableOn(DateTimeOffset moment) =>
        IsActive
        && StartsAt <= moment
        && (EndsAt is null || EndsAt >= moment);

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result Validate(PromotionType type, decimal value, DateTimeOffset startsAt, DateTimeOffset? endsAt)
    {
        if (!Enum.IsDefined(type))
        {
            return Result.Failure(
                new Error("catalog.pricing.promotion.type.invalid", "El tipo de promoción no es válido.", ErrorType.Validation));
        }

        if (value < 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.promotion.value.range", "El valor de la promoción no puede ser negativo.", ErrorType.Validation));
        }

        if (type == PromotionType.Percentage && value > 100m)
        {
            return Result.Failure(
                new Error("catalog.pricing.promotion.value.range", "El porcentaje de la promoción no puede superar 100.", ErrorType.Validation));
        }

        if (endsAt.HasValue && endsAt.Value < startsAt)
        {
            return Result.Failure(
                new Error("catalog.pricing.promotion.schedule", "La fecha final no puede ser anterior a la inicial.", ErrorType.Validation));
        }

        return Result.Success();
    }

    private static Result<string> NormalizeCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.promotion.code.required", "El código de la promoción es obligatorio.", ErrorType.Validation));
        }

        var normalized = code.Trim().ToUpperInvariant();
        if (normalized.Length > CodeMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.promotion.code.length", $"El código no puede superar {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(normalized);
    }

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.promotion.name.required", "El nombre de la promoción es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.promotion.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string?> NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Success<string?>(null);
        }

        var trimmed = description.Trim();
        if (trimmed.Length > DescriptionMaxLength)
        {
            return Result.Failure<string?>(
                new Error("catalog.pricing.promotion.description.length", $"La descripción no puede superar {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }
}
