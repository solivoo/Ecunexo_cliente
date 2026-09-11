using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;

public sealed record CancelEcommerceOrderCommand(
    Guid TenantId,
    Guid OrderId,
    string Reason,
    Guid? UserId = null,
    string? UserName = null) : ICommand<CancelEcommerceOrderResponse>;

public sealed record CancelEcommerceOrderResponse(
    Guid OrderId,
    EcommerceOrderStatus Status,
    string Reason,
    DateTimeOffset? CancelledAt);
