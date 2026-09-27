using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.UpdateEcommerceStorefrontSettings;

namespace EcuNexo.Api.Contracts.V1.Storefront;

public sealed record EcommerceStorefrontShippingMethodRequest(string Code, decimal Cost);

public sealed record UpdateEcommerceStorefrontSettingsRequest(
    IReadOnlyList<string> PaymentMethods,
    IReadOnlyList<EcommerceStorefrontShippingMethodRequest> ShippingMethods,
    string? BankTransferInstructions,
    int PaymentHoldHours,
    bool ReserveOnOrder = true,
    string? ContactWhatsapp = null,
    string? OrdersNotificationEmail = null,
    int MaxPendingOrders = EcommerceStorefrontSettingsReader.DefaultMaxPendingOrders)
{
    public UpdateEcommerceStorefrontSettingsCommand ToCommand(Guid tenantId, Guid? updatedBy) =>
        new(
            tenantId,
            PaymentMethods ?? [],
            ShippingMethods?
                .Select(method => new UpdateEcommerceStorefrontShippingMethodInput(method.Code, method.Cost))
                .ToList() ?? [],
            BankTransferInstructions,
            PaymentHoldHours,
            ReserveOnOrder,
            ContactWhatsapp,
            OrdersNotificationEmail,
            MaxPendingOrders,
            updatedBy);
}
