using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.ShipEcommerceOrder;

public sealed record ShipEcommerceOrderCommand(
    Guid TenantId,
    Guid OrderId,
    string Carrier,
    string? TrackingNumber,
    Guid? UserId = null,
    string? UserName = null) : ICommand<ShipEcommerceOrderResponse>;

public sealed record ShipEcommerceOrderResponse(
    Guid OrderId,
    EcommerceOrderStatus Status,
    string Carrier,
    string? TrackingNumber,
    DateTimeOffset? ShippedAt);
