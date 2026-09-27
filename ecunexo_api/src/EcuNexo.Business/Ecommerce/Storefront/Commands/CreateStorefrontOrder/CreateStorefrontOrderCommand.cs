using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;

public sealed record CreateStorefrontOrderCustomerInput(
    string Name,
    string Email,
    string Phone,
    string? TaxId);

public sealed record CreateStorefrontOrderShippingInput(
    string Address,
    string City,
    string? Reference);

public sealed record CreateStorefrontOrderItemInput(
    Guid CatalogItemId,
    int Quantity);

public sealed record CreateStorefrontOrderCommand(
    Guid TenantId,
    string RequestId,
    CreateStorefrontOrderCustomerInput Customer,
    CreateStorefrontOrderShippingInput Shipping,
    string PaymentMethod,
    string ShippingMethod,
    IReadOnlyList<CreateStorefrontOrderItemInput> Items,
    string? Notes = null,
    string? ContactFax = null,
    int? FormElapsedMs = null,
    string? ClientIp = null,
    string? UserAgent = null,
    string? TurnstileToken = null) : ICommand<StorefrontOrderCreatedDto>;
