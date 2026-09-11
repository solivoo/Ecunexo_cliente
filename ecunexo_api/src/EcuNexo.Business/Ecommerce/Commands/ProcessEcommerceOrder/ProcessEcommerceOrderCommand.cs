using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.ProcessEcommerceOrder;

public sealed record ProcessEcommerceOrderCommand(
    Guid TenantId,
    Guid OrderId,
    Guid? UserId = null,
    string? UserName = null) : ICommand<ProcessEcommerceOrderResponse>;

public sealed record ProcessEcommerceOrderResponse(
    Guid OrderId,
    EcommerceOrderStatus Status);
