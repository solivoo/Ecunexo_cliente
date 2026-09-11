namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Información de destino y despacho para la entrega del pedido.
/// </summary>
public sealed record EcommerceShippingInfo(
    string RecipientName,
    string? RecipientPhone,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? Province,
    string? PostalCode,
    string? Carrier,
    string? TrackingNumber,
    string? Notes);
