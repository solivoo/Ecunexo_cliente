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
    string? ContactFax = null,
    int? FormElapsedMs = null,
    string? TurnstileToken = null,
    bool AcceptPrivacyPolicy = false)
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
            ContactFax,
            FormElapsedMs,
            clientIp,
            userAgent,
            TurnstileToken,
            AcceptPrivacyPolicy);
}
