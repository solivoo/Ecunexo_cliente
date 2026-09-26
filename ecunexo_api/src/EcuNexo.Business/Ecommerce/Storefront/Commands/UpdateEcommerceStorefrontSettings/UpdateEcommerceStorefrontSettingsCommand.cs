using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Ecommerce.Storefront.Commands.UpdateEcommerceStorefrontSettings;

public sealed record UpdateEcommerceStorefrontShippingMethodInput(string Code, decimal Cost);

public sealed record UpdateEcommerceStorefrontSettingsCommand(
    Guid TenantId,
    IReadOnlyList<string> PaymentMethods,
    IReadOnlyList<UpdateEcommerceStorefrontShippingMethodInput> ShippingMethods,
    string? BankTransferInstructions,
    int PaymentHoldHours,
    bool ReserveOnOrder = true,
    string? ContactWhatsapp = null,
    Guid? UpdatedBy = null) : ICommand<EcommerceStorefrontSettingsDto>;
