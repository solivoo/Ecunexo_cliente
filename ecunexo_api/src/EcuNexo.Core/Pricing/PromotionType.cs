namespace EcuNexo.Core.Pricing;

/// <summary>Tipo de beneficio de una promoción de venta.</summary>
public enum PromotionType
{
    /// <summary>Descuento porcentual sobre el subtotal de la línea.</summary>
    Percentage = 0,

    /// <summary>Descuento de valor fijo por unidad.</summary>
    FixedAmount = 1,

    /// <summary>Reemplaza el precio unitario por un valor promocional.</summary>
    FixedPrice = 2,
}
