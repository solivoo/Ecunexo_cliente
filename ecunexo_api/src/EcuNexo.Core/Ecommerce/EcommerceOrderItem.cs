using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Línea de ítem o producto incluido en la orden de compra ecommerce.
/// </summary>
public sealed class EcommerceOrderItem : Entity<Guid>
{
    private EcommerceOrderItem()
    {
    }

    public Guid EcommerceOrderId { get; private set; }

    public EcommerceOrder? EcommerceOrder { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public CatalogItem? CatalogItem { get; private set; }

    public string Sku { get; private set; } = string.Empty;

    public string ItemName { get; private set; } = string.Empty;

    public decimal Quantity { get; private set; }

    public decimal UnitPrice { get; private set; }

    public decimal DiscountAmount { get; private set; }

    public decimal TaxRate { get; private set; }

    public decimal TaxAmount { get; private set; }

    public decimal TotalAmount { get; private set; }

    public static Result<EcommerceOrderItem> Create(
        Guid id,
        Guid ecommerceOrderId,
        Guid catalogItemId,
        string sku,
        string itemName,
        decimal quantity,
        decimal unitPrice,
        decimal discountAmount = 0m,
        decimal taxRate = 0.15m)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.id_empty", "El id del item no puede ser vacío.", ErrorType.Validation));
        }

        if (catalogItemId == Guid.Empty)
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.catalog_item_required", "El producto de catálogo es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(itemName))
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.name_required", "La descripción del producto es obligatoria.", ErrorType.Validation));
        }

        if (quantity <= 0)
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.quantity_invalid", "La cantidad del producto debe ser mayor a cero.", ErrorType.Validation));
        }

        if (unitPrice < 0)
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.unit_price_invalid", "El precio unitario no puede ser negativo.", ErrorType.Validation));
        }

        if (discountAmount < 0)
        {
            return Result.Failure<EcommerceOrderItem>(
                new Error("ecommerce.item.discount_invalid", "El descuento no puede ser negativo.", ErrorType.Validation));
        }

        var subtotal = Math.Max(0m, (quantity * unitPrice) - discountAmount);
        var taxAmount = Math.Round(subtotal * taxRate, 2, MidpointRounding.AwayFromZero);
        var totalAmount = subtotal + taxAmount;

        return new EcommerceOrderItem
        {
            Id = id,
            EcommerceOrderId = ecommerceOrderId,
            CatalogItemId = catalogItemId,
            Sku = sku?.Trim() ?? string.Empty,
            ItemName = itemName.Trim(),
            Quantity = decimal.Round(quantity, 4, MidpointRounding.AwayFromZero),
            UnitPrice = decimal.Round(unitPrice, 4, MidpointRounding.AwayFromZero),
            DiscountAmount = decimal.Round(discountAmount, 2, MidpointRounding.AwayFromZero),
            TaxRate = decimal.Round(taxRate, 4, MidpointRounding.AwayFromZero),
            TaxAmount = taxAmount,
            TotalAmount = totalAmount,
        };
    }
}
