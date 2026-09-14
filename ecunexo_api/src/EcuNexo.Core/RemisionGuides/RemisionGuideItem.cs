using EcuNexo.Core.Common;

namespace EcuNexo.Core.RemisionGuides;

/// <summary>
/// Línea o mercancía transportada en una Guía de Remisión (SRI 06).
/// </summary>
public sealed class RemisionGuideItem : Entity<Guid>
{
    public const int ItemCodeMaxLength = 50;
    public const int DescriptionMaxLength = 300;
    public const int UnitOfMeasureMaxLength = 25;

    private RemisionGuideItem()
    {
    }

    public Guid RemisionGuideId { get; private set; }
    public string ItemCode { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public string? UnitOfMeasure { get; private set; }
    public string? InternalReference { get; private set; }

    public static Result<RemisionGuideItem> Create(
        Guid id,
        Guid remisionGuideId,
        string itemCode,
        string description,
        decimal quantity,
        string? unitOfMeasure = null,
        string? internalReference = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.id.empty", "El Id del ítem es obligatorio.", ErrorType.Validation));
        }

        if (remisionGuideId == Guid.Empty)
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.guide_id.empty", "El Id de la guía de remisión es obligatorio.", ErrorType.Validation));
        }

        var normalizedCode = itemCode?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedCode))
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.code.empty", "El código del producto transportado es obligatorio.", ErrorType.Validation));
        }

        if (normalizedCode.Length > ItemCodeMaxLength)
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.code.too_long", $"El código no puede exceder {ItemCodeMaxLength} caracteres.", ErrorType.Validation));
        }

        var normalizedDesc = description?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(normalizedDesc))
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.description.empty", "La descripción del bien transportado es obligatoria.", ErrorType.Validation));
        }

        if (normalizedDesc.Length > DescriptionMaxLength)
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.description.too_long", $"La descripción no puede exceder {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure<RemisionGuideItem>(new Error("remision_item.quantity.invalid", "La cantidad transportada debe ser mayor a cero.", ErrorType.Validation));
        }

        var item = new RemisionGuideItem
        {
            Id = id,
            RemisionGuideId = remisionGuideId,
            ItemCode = normalizedCode,
            Description = normalizedDesc,
            Quantity = decimal.Round(quantity, 4),
            UnitOfMeasure = string.IsNullOrWhiteSpace(unitOfMeasure) ? null : unitOfMeasure.Trim(),
            InternalReference = string.IsNullOrWhiteSpace(internalReference) ? null : internalReference.Trim()
        };

        return Result.Success(item);
    }
}
