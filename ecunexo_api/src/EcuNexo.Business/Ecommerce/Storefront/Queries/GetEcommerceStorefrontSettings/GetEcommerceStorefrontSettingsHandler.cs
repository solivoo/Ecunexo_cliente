using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceStorefrontSettings;

public sealed class GetEcommerceStorefrontSettingsHandler
    : IQueryHandler<GetEcommerceStorefrontSettingsQuery, EcommerceStorefrontSettingsDto>
{
    private readonly IEcommerceStorefrontSettingsReader _settings;

    public GetEcommerceStorefrontSettingsHandler(IEcommerceStorefrontSettingsReader settings)
    {
        _settings = settings;
    }

    public async Task<Result<EcommerceStorefrontSettingsDto>> Handle(
        GetEcommerceStorefrontSettingsQuery query,
        CancellationToken ct)
    {
        var settings = await _settings.ResolveAsync(query.TenantId, ct).ConfigureAwait(false);
        return Result.Success(Map(settings));
    }

    internal static EcommerceStorefrontSettingsDto Map(EcommerceStorefrontSettings settings) =>
        new(
            settings.PaymentMethods.Select(method => method.ToString()).ToList(),
            settings.ShippingMethods
                .Select(option => new StorefrontShippingMethodSettingDto(option.Method.ToString(), option.Cost))
                .ToList(),
            settings.BankTransferInstructions,
            settings.PaymentHoldHours,
            settings.ReserveOnOrder,
            settings.ContactWhatsapp,
            settings.OrdersNotificationEmail,
            settings.MaxPendingOrders,
            settings.MaintenanceEnabled,
            settings.MaintenanceMessage,
            settings.MinOrderAmount);
}
