namespace EcuNexo.Core.Pricing;

/// <summary>
/// Tipo de descuento aplicado en el escalón por volumen.
/// </summary>
public enum VolumeDiscountSchemeType
{
    /// <summary>Descuento porcentual (0 a 100%) sobre la línea.</summary>
    Percentage = 0,

    /// <summary>Descuento monetario fijo por cada unidad vendida (ej. -$0.50 c/u).</summary>
    FixedAmount = 1,

    /// <summary>Precio unitario comercial fijo para el escalón (ej. $2.50 c/u).</summary>
    FixedPrice = 2,
}
