using EcuNexo.Core.Common;

namespace EcuNexo.Core.CreditNotes;

/// <summary>
/// Ítem / Detalle de la Nota de Crédito Electrónica.
/// Soporta hasta 6 decimales para cantidad y precio unitario conforme a Ficha Técnica SRI v2.32 Anexo 3.
/// </summary>
public sealed class CreditNoteItem : Entity<Guid>
{
    public const int CodeMaxLength = 25;
    public const int DescriptionMaxLength = 300;

    private CreditNoteItem()
    {
    }

    public Guid CreditNoteId { get; private set; }
    public int LineNumber { get; private set; }
    public string ItemCode { get; private set; } = string.Empty;
    public string? AdditionalCode { get; private set; }
    public string Description { get; private set; } = string.Empty;

    /// <summary>
    /// Cantidad del ítem devuelto / ajustado (soporta hasta 6 decimales).
    /// </summary>
    public decimal Quantity { get; private set; }

    /// <summary>
    /// Precio unitario sin impuestos (soporta hasta 6 decimales).
    /// </summary>
    public decimal UnitPrice { get; private set; }

    /// <summary>
    /// Descuento en dólares (redondeado a 2 decimales).
    /// </summary>
    public decimal Discount { get; private set; }

    /// <summary>
    /// Subtotal del ítem sin impuestos: Math.Round((Quantity * UnitPrice) - Discount, 2).
    /// </summary>
    public decimal Subtotal { get; private set; }

    /// <summary>
    /// Código del impuesto (Tabla 16 SRI: '2' para IVA).
    /// </summary>
    public string VatCode { get; private set; } = "2";

    /// <summary>
    /// Código de la tarifa de IVA (Tabla 17 SRI: '0' 0%, '2' 12%, '3' 14%, '4' 15%, '5' 5%, '6' No Objeto, '7' Exento, '10' 13%).
    /// Debe corresponder a la tarifa de IVA vigente en la fecha del comprobante sustento.
    /// </summary>
    public string VatPercentageCode { get; private set; } = "4";

    /// <summary>
    /// Porcentaje numérico de IVA (ej. 15.00, 13.00, 12.00, 5.00, 0.00).
    /// </summary>
    public decimal VatRate { get; private set; } = 15.00m;

    /// <summary>
    /// Base imponible de IVA. Igual al Subtotal.
    /// </summary>
    public decimal VatBase { get; private set; }

    /// <summary>
    /// Valor en dólares del IVA del ítem: Math.Round(VatBase * (VatRate / 100), 2).
    /// </summary>
    public decimal VatAmount { get; private set; }

    /// <summary>
    /// Total del ítem con impuestos: Subtotal + VatAmount.
    /// </summary>
    public decimal Total { get; private set; }

    /// <summary>
    /// ID de la bodega destino para retorno de inventario (opcional).
    /// </summary>
    public Guid? WarehouseId { get; private set; }

    public static Result<CreditNoteItem> Create(
        Guid id,
        Guid creditNoteId,
        int lineNumber,
        string itemCode,
        string? additionalCode,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal discount,
        string vatPercentageCode,
        decimal vatRate,
        Guid? warehouseId = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.id_required", "El ID del ítem es obligatorio.", ErrorType.Validation));
        }

        if (lineNumber <= 0)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.line_number_invalid", "El número de línea debe ser mayor a cero.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.description_required", "La descripción del ítem es obligatoria.", ErrorType.Validation));
        }

        if (description.Trim().Length > DescriptionMaxLength)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.description_too_long", $"La descripción no puede exceder {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.quantity_invalid", "La cantidad debe ser mayor a cero.", ErrorType.Validation));
        }

        if (unitPrice < 0)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.unit_price_invalid", "El precio unitario no puede ser negativo.", ErrorType.Validation));
        }

        if (discount < 0)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.discount_invalid", "El descuento no puede ser negativo.", ErrorType.Validation));
        }

        var grossAmount = Math.Round(quantity * unitPrice, 6, MidpointRounding.AwayFromZero);
        if (discount > grossAmount)
        {
            return Result.Failure<CreditNoteItem>(new Error("credit_note_item.discount_exceeds_gross", "El descuento no puede exceder el valor bruto del ítem.", ErrorType.Validation));
        }

        var subtotal = Math.Round(grossAmount - discount, 2, MidpointRounding.AwayFromZero);
        var vatBase = subtotal;
        var vatAmount = Math.Round(vatBase * (vatRate / 100m), 2, MidpointRounding.AwayFromZero);
        var total = subtotal + vatAmount;

        var cleanItemCode = string.IsNullOrWhiteSpace(itemCode) ? "PROD" : itemCode.Trim();
        if (cleanItemCode.Length > CodeMaxLength)
        {
            cleanItemCode = cleanItemCode[..CodeMaxLength];
        }

        string? cleanAddCode = null;
        if (!string.IsNullOrWhiteSpace(additionalCode))
        {
            cleanAddCode = additionalCode.Trim();
            if (cleanAddCode.Length > CodeMaxLength)
            {
                cleanAddCode = cleanAddCode[..CodeMaxLength];
            }
        }

        var item = new CreditNoteItem
        {
            Id = id,
            CreditNoteId = creditNoteId,
            LineNumber = lineNumber,
            ItemCode = cleanItemCode,
            AdditionalCode = cleanAddCode,
            Description = description.Trim(),
            Quantity = Math.Round(quantity, 6, MidpointRounding.AwayFromZero),
            UnitPrice = Math.Round(unitPrice, 6, MidpointRounding.AwayFromZero),
            Discount = Math.Round(discount, 2, MidpointRounding.AwayFromZero),
            Subtotal = subtotal,
            VatCode = "2",
            VatPercentageCode = string.IsNullOrWhiteSpace(vatPercentageCode) ? "4" : vatPercentageCode.Trim(),
            VatRate = vatRate,
            VatBase = vatBase,
            VatAmount = vatAmount,
            Total = total,
            WarehouseId = warehouseId
        };

        return Result.Success(item);
    }
}
