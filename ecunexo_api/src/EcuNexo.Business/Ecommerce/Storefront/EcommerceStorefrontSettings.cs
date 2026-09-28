using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Storefront;

/// <summary>Opción de envío habilitada en la tienda con su costo fijo.</summary>
public sealed record ShippingMethodOption(EcommerceShippingMethod Method, decimal Cost);

/// <summary>Configuración efectiva del checkout público de una tienda.</summary>
public sealed record EcommerceStorefrontSettings(
    IReadOnlyList<EcommercePaymentMethod> PaymentMethods,
    IReadOnlyList<ShippingMethodOption> ShippingMethods,
    string BankTransferInstructions,
    int PaymentHoldHours,
    bool ReserveOnOrder = true,
    string ContactWhatsapp = "",
    string OrdersNotificationEmail = "",
    int MaxPendingOrders = EcommerceStorefrontSettingsReader.DefaultMaxPendingOrders,
    bool MaintenanceEnabled = false,
    string MaintenanceMessage = "",
    decimal MinOrderAmount = 0m);

/// <summary>
/// Lee la configuración efectiva de la tienda (global/plan/tenant) aplicando defaults seguros.
/// </summary>
public interface IEcommerceStorefrontSettingsReader
{
    Task<EcommerceStorefrontSettings> ResolveAsync(Guid tenantId, CancellationToken ct);
}
