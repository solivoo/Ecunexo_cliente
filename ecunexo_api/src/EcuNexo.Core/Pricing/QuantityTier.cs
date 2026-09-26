using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Escala de precio por cantidad dentro de un precio de producto. <see cref="QuantityTo"/> nulo
/// indica ausencia de límite superior. Los rangos activos no pueden superponerse.
/// </summary>
public sealed class QuantityTier : Entity<Guid>, IAuditable
{
    private QuantityTier()
    {
    }

    public Guid ProductPriceId { get; private set; }

    public ProductPrice? ProductPrice { get; private set; }

    public decimal QuantityFrom { get; private set; }

    public decimal? QuantityTo { get; private set; }

    public decimal UnitPrice { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<QuantityTier> Create(
        Guid id,
        Guid productPriceId,
        decimal quantityFrom,
        decimal? quantityTo,
        decimal unitPrice,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || productPriceId == Guid.Empty)
        {
            return Result.Failure<QuantityTier>(
                new Error("catalog.pricing.tier.keys.invalid", "El identificador de la escala y del precio son obligatorios.", ErrorType.Validation));
        }

        var validation = Validate(quantityFrom, quantityTo, unitPrice);
        if (validation.IsFailure)
        {
            return Result.Failure<QuantityTier>(validation.Error!);
        }

        return new QuantityTier
        {
            Id = id,
            ProductPriceId = productPriceId,
            QuantityFrom = NormalizeQuantity(quantityFrom),
            QuantityTo = quantityTo.HasValue ? NormalizeQuantity(quantityTo.Value) : null,
            UnitPrice = NormalizePrice(unitPrice),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(decimal quantityFrom, decimal? quantityTo, decimal unitPrice, Guid? updatedBy = null)
    {
        var validation = Validate(quantityFrom, quantityTo, unitPrice);
        if (validation.IsFailure)
        {
            return validation;
        }

        QuantityFrom = NormalizeQuantity(quantityFrom);
        QuantityTo = quantityTo.HasValue ? NormalizeQuantity(quantityTo.Value) : null;
        UnitPrice = NormalizePrice(unitPrice);
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>True cuando la cantidad cae dentro del rango de la escala.</summary>
    public bool Includes(decimal quantity) =>
        quantity >= QuantityFrom && (QuantityTo is null || quantity <= QuantityTo.Value);

    /// <summary>True cuando los rangos de ambas escalas se superponen.</summary>
    public bool Overlaps(decimal otherFrom, decimal? otherTo) =>
        QuantityFrom <= (otherTo ?? decimal.MaxValue) && otherFrom <= (QuantityTo ?? decimal.MaxValue);

    internal static Result Validate(decimal quantityFrom, decimal? quantityTo, decimal unitPrice)
    {
        if (quantityFrom <= 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.tier.range", "La cantidad inicial de la escala debe ser mayor que cero.", ErrorType.Validation));
        }

        if (quantityTo.HasValue && quantityTo.Value < quantityFrom)
        {
            return Result.Failure(
                new Error("catalog.pricing.tier.range", "La cantidad final no puede ser menor que la inicial.", ErrorType.Validation));
        }

        if (unitPrice < 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.tier.price.range", "El precio de la escala no puede ser negativo.", ErrorType.Validation));
        }

        return Result.Success();
    }

    private static decimal NormalizeQuantity(decimal quantity) =>
        decimal.Round(quantity, 4, MidpointRounding.AwayFromZero);

    private static decimal NormalizePrice(decimal price) =>
        decimal.Round(price, 6, MidpointRounding.AwayFromZero);

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
