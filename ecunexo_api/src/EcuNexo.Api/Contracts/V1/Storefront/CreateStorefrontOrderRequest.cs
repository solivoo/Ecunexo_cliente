using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

namespace EcuNexo.Api.Contracts.V1.Storefront;

public sealed record CreateStorefrontOrderRequest(
    string RequestId,
    CreateStorefrontOrderCustomerInput Customer,
    CreateStorefrontOrderShippingInput Shipping,
    string PaymentMethod,
    string ShippingMethod,
    IReadOnlyList<CreateStorefrontOrderItemInput> Items,
    string? Notes = null,
    string? Website = null,
    int? FormElapsedMs = null)
{
    public CreateStorefrontOrderCommand ToCommand(
        Guid tenantId,
        string? clientIp = null,
        string? userAgent = null) =>
        new(
            tenantId,
            RequestId,
            Customer,
            Shipping,
            PaymentMethod,
            ShippingMethod,
            Items ?? [],
            Notes,
            Website,
            FormElapsedMs,
            clientIp,
            userAgent);
}
