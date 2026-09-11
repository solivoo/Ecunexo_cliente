namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Información del cliente y facturación asociada a la orden de compra.
/// </summary>
public sealed record EcommerceCustomerInfo(
    string CustomerName,
    string TaxId,
    string? TaxIdType,
    string Email,
    string? Phone,
    string? Address);
