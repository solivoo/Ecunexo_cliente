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

    /// <summary>Si es <c>true</c>, los pedidos web reservan stock al crearse; si no, al confirmar el pago.</summary>
    public const string StorefrontReserveOnOrder = "ecommerce.storefront.reserve_on_order";

    /// <summary>WhatsApp de contacto de la tienda normalizado a dígitos (opcional).</summary>
    public const string StorefrontContactWhatsapp = "ecommerce.storefront.contact_whatsapp";

    /// <summary>Correo del equipo de la tienda que recibe avisos de pedidos (opcional).</summary>
    public const string StorefrontOrdersNotificationEmail = "ecommerce.storefront.orders_notification_email";

    /// <summary>Máximo de pedidos pendientes por contacto en la tienda (1..50).</summary>
    public const string StorefrontMaxPendingOrders = "ecommerce.storefront.max_pending_orders";
}
