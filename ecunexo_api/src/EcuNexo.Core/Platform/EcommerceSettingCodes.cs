namespace EcuNexo.Core.Platform;

/// <summary>
/// Códigos de configuración de la tienda pública configurable (checkout).
/// Se persisten en <c>platform.sys_settings</c> con scope tenant.
/// </summary>
public static class EcommerceSettingCodes
{
    /// <summary>Arreglo JSON con los nombres de <c>EcommercePaymentMethod</c> habilitados.</summary>
    public const string StorefrontPaymentMethods = "ecommerce.storefront.payment_methods";

    /// <summary>Arreglo JSON de <c>{ "code": "Courier", "cost": 0.00 }</c> con los envíos habilitados.</summary>
    public const string StorefrontShippingMethods = "ecommerce.storefront.shipping_methods";

    /// <summary>Instrucciones de transferencia bancaria mostradas al cliente.</summary>
    public const string StorefrontBankTransferInstructions = "ecommerce.storefront.bank_transfer_instructions";

    /// <summary>Horas que se mantiene reservado el stock antes de expirar el pedido (1..720).</summary>
    public const string StorefrontPaymentHoldHours = "ecommerce.storefront.payment_hold_hours";
}
