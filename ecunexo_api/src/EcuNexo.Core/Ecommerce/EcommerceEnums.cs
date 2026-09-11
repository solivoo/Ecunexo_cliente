namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Estado del ciclo de vida de una orden de compra ecommerce.
/// </summary>
public enum EcommerceOrderStatus
{
    /// <summary>Pedido creado por el cliente, stock reservado inmediatamente en bodega.</summary>
    Placed = 0,

    /// <summary>Pago verificado y aprobado, o contra entrega validado. Listo para preparación.</summary>
    Confirmed = 1,

    /// <summary>En preparación de paquetes (picking y packing) en bodega.</summary>
    Processing = 2,

    /// <summary>Despachado y en tránsito con transportista/courier. Reserva liquidada con egreso en kárdex.</summary>
    Shipped = 3,

    /// <summary>Entregado satisfactoriamente al cliente final.</summary>
    Delivered = 4,

    /// <summary>Cancelado antes de despacho. Reserva de stock liberada automáticamente.</summary>
    Cancelled = 5,

    /// <summary>Devuelto o reembolsado post-entrega.</summary>
    Refunded = 6,
}

/// <summary>
/// Estado del pago asociado a la orden.
/// </summary>
public enum EcommercePaymentStatus
{
    /// <summary>Pendiente de acreditación o confirmación.</summary>
    Pending = 0,

    /// <summary>Autorizado por pasarela de pagos (pre-captura).</summary>
    Authorized = 1,

    /// <summary>Completamente pagado y conciliado.</summary>
    Paid = 2,

    /// <summary>Rechazado o fallido.</summary>
    Failed = 3,

    /// <summary>Reembolsado al cliente.</summary>
    Refunded = 4,
}

/// <summary>
/// Método de pago utilizado en la tienda online.
/// </summary>
public enum EcommercePaymentMethod
{
    /// <summary>Tarjeta de crédito o débito.</summary>
    CreditCard = 1,

    /// <summary>Transferencia bancaria o depósito comprobado.</summary>
    BankTransfer = 2,

    /// <summary>Pago en efectivo contra entrega.</summary>
    CashOnDelivery = 3,

    /// <summary>Pasarela online (Payphone, DeUna, Kushki, PayPal, etc.).</summary>
    PaymentGateway = 4,

    /// <summary>Otro método de pago.</summary>
    Other = 99,
}

/// <summary>
/// Método o modalidad de entrega/envío.
/// </summary>
public enum EcommerceShippingMethod
{
    /// <summary>Envío nacional o interprovincial por courier (Servientrega, Urbano, Tramaco).</summary>
    Courier = 1,

    /// <summary>Retiro directo en tienda física o bodega principal (Click and Collect).</summary>
    StorePickup = 2,

    /// <summary>Entrega local express motorizada.</summary>
    LocalDelivery = 3,
}
