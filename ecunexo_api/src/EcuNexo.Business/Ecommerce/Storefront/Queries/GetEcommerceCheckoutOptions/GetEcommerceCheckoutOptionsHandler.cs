using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceCheckoutOptions;

public sealed class GetEcommerceCheckoutOptionsHandler
    : IQueryHandler<GetEcommerceCheckoutOptionsQuery, EcommerceCheckoutOptionsDto>
{
    private readonly ITenantRepository _tenants;
    private readonly IEcommerceStorefrontSettingsReader _settings;

    public GetEcommerceCheckoutOptionsHandler(
        ITenantRepository tenants,
        IEcommerceStorefrontSettingsReader settings)
    {
        _tenants = tenants;
        _settings = settings;
    }

    public async Task<Result<EcommerceCheckoutOptionsDto>> Handle(
        GetEcommerceCheckoutOptionsQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<EcommerceCheckoutOptionsDto>(tenantError);
        }

        var settings = await _settings.ResolveAsync(query.TenantId, ct).ConfigureAwait(false);

        var paymentMethods = settings.PaymentMethods
            .Select(method => new EcommerceCheckoutPaymentMethodDto(
                method.ToString(),
                EcommerceStorefrontLabels.ForPayment(method),
                method == EcommercePaymentMethod.BankTransfer ? settings.BankTransferInstructions : null))
            .ToList();

        var shippingMethods = settings.ShippingMethods
            .Select(option => new EcommerceCheckoutShippingMethodDto(
                option.Method.ToString(),
                EcommerceStorefrontLabels.ForShipping(option.Method),
                option.Cost))
            .ToList();

        var whatsappPhone = string.IsNullOrWhiteSpace(settings.ContactWhatsapp)
            ? null
            : settings.ContactWhatsapp;

        return Result.Success(new EcommerceCheckoutOptionsDto(paymentMethods, shippingMethods, whatsappPhone));
    }
}
