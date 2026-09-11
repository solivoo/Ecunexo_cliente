using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Commands.ConfirmEcommerceOrderPayment;

public sealed record ConfirmEcommerceOrderPaymentCommand(
    Guid TenantId,
    Guid OrderId,
    string? PaymentReference,
    Guid? UserId = null,
    string? UserName = null) : ICommand<ConfirmEcommerceOrderPaymentResponse>;

public sealed record ConfirmEcommerceOrderPaymentResponse(
    Guid OrderId,
    EcommerceOrderStatus Status,
    EcommercePaymentStatus PaymentStatus);
