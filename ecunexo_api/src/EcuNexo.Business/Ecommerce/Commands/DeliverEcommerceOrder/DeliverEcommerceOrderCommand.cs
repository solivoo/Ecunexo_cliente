using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.DeliverEcommerceOrder;

public sealed record DeliverEcommerceOrderCommand(
    Guid TenantId,
    Guid OrderId,
    Guid? UserId = null,
    string? UserName = null) : ICommand<DeliverEcommerceOrderResponse>;

public sealed record DeliverEcommerceOrderResponse(
    Guid OrderId,
    EcommerceOrderStatus Status);
