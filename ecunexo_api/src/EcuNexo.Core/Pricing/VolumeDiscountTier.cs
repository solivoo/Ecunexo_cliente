using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Escalón de cantidad dentro de un esquema de descuento por volumen.
/// </summary>
public sealed class VolumeDiscountTier : Entity<Guid>, IAuditable
{
    private VolumeDiscountTier()
    {
    }

    public Guid SchemeId { get; private set; }

    public VolumeDiscountScheme? Scheme { get; private set; }

    public decimal QuantityFrom { get; private set; }

    public decimal? QuantityTo { get; private set; }

    /// <summary>
    /// Valor del escalón: porcentaje (0-100), monto de descuento por unidad o precio unitario fijo según el tipo del esquema.
    /// </summary>
    public decimal Value { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<VolumeDiscountTier> Create(
        Guid id,
        Guid schemeId,
        decimal quantityFrom,
        decimal? quantityTo,
        decimal value,
        VolumeDiscountSchemeType type,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || schemeId == Guid.Empty)
        {
            return Result.Failure<VolumeDiscountTier>(
                new Error("catalog.pricing.volume_tier.keys.invalid", "El identificador del escalón y del esquema son obligatorios.", ErrorType.Validation));
        }

        var validation = Validate(quantityFrom, quantityTo, value, type);
        if (validation.IsFailure)
        {
            return Result.Failure<VolumeDiscountTier>(validation.Error!);
        }

        return new VolumeDiscountTier
        {
            Id = id,
            SchemeId = schemeId,
            QuantityFrom = NormalizeQuantity(quantityFrom),
            QuantityTo = quantityTo.HasValue ? NormalizeQuantity(quantityTo.Value) : null,
            Value = NormalizeValue(value),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        decimal quantityFrom,
        decimal? quantityTo,
        decimal value,
        VolumeDiscountSchemeType type,
        Guid? updatedBy = null)
    {
        var validation = Validate(quantityFrom, quantityTo, value, type);
        if (validation.IsFailure)
        {
            return validation;
        }

        QuantityFrom = NormalizeQuantity(quantityFrom);
        QuantityTo = quantityTo.HasValue ? NormalizeQuantity(quantityTo.Value) : null;
        Value = NormalizeValue(value);
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    public bool Includes(decimal quantity) =>
        quantity >= QuantityFrom && (QuantityTo is null || quantity <= QuantityTo.Value);

    public bool Overlaps(decimal otherFrom, decimal? otherTo) =>
        QuantityFrom <= (otherTo ?? decimal.MaxValue) && otherFrom <= (QuantityTo ?? decimal.MaxValue);

    internal static Result Validate(
        decimal quantityFrom,
        decimal? quantityTo,
        decimal value,
        VolumeDiscountSchemeType type)
    {
        if (quantityFrom <= 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.volume_tier.range", "La cantidad inicial del escalón debe ser mayor que cero.", ErrorType.Validation));
        }

        if (quantityTo.HasValue && quantityTo.Value < quantityFrom)
        {
            return Result.Failure(
                new Error("catalog.pricing.volume_tier.range", "La cantidad final no puede ser menor que la inicial.", ErrorType.Validation));
        }

        if (value < 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.volume_tier.value.range", "El valor del escalón no puede ser negativo.", ErrorType.Validation));
        }

        if (type == VolumeDiscountSchemeType.Percentage && value > 100m)
        {
            return Result.Failure(
                new Error("catalog.pricing.volume_tier.percentage.range", "El porcentaje de descuento no puede ser mayor que 100.", ErrorType.Validation));
        }

        return Result.Success();
    }

    private static decimal NormalizeQuantity(decimal quantity) =>
        decimal.Round(quantity, 4, MidpointRounding.AwayFromZero);

    private static decimal NormalizeValue(decimal value) =>
        decimal.Round(value, 6, MidpointRounding.AwayFromZero);

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
