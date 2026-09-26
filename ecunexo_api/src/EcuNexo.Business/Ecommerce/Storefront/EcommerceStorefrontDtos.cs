using System.Text.Json.Serialization;
using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Storefront;

/// <summary>Envío habilitado con su costo fijo tal como se persiste en settings.</summary>
public sealed record StorefrontShippingMethodSettingDto(string Code, decimal Cost);

/// <summary>Configuración del checkout que administra la empresa.</summary>
public sealed record EcommerceStorefrontSettingsDto(
    IReadOnlyList<string> PaymentMethods,
    IReadOnlyList<StorefrontShippingMethodSettingDto> ShippingMethods,
    string BankTransferInstructions,
    int PaymentHoldHours);

/// <summary>Opciones de pago y envío expuestas al comprador anónimo.</summary>
public sealed record EcommerceCheckoutOptionsDto(
    IReadOnlyList<EcommerceCheckoutPaymentMethodDto> PaymentMethods,
    IReadOnlyList<EcommerceCheckoutShippingMethodDto> ShippingMethods);

public sealed record EcommerceCheckoutPaymentMethodDto(
    string Code,
    string Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Instructions);

public sealed record EcommerceCheckoutShippingMethodDto(string Code, string Label, decimal Cost);

/// <summary>Resultado de crear un pedido desde la tienda pública.</summary>
public sealed record StorefrontOrderCreatedDto(
    Guid OrderId,
    string OrderNumber,
    string Status,
    decimal Subtotal,
    decimal TaxAmount,
    decimal ShippingCost,
    decimal TotalAmount,
    string PaymentMethod,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PaymentInstructions);

/// <summary>Etiquetas en español para los métodos de pago y envío del checkout público.</summary>
public static class EcommerceStorefrontLabels
{
    public static string ForPayment(EcommercePaymentMethod method) => method switch
    {
        EcommercePaymentMethod.BankTransfer => "Transferencia bancaria",
        EcommercePaymentMethod.CashOnDelivery => "Contra entrega",
        EcommercePaymentMethod.CreditCard => "Tarjeta de crédito/débito",
        EcommercePaymentMethod.PaymentGateway => "Pago en línea",
        EcommercePaymentMethod.Other => "Otro",
        _ => "Otro",
    };

    public static string ForShipping(EcommerceShippingMethod method) => method switch
    {
        EcommerceShippingMethod.Courier => "Envío a domicilio",
        EcommerceShippingMethod.StorePickup => "Retiro en tienda",
        EcommerceShippingMethod.LocalDelivery => "Entrega local",
        _ => "Envío",
    };
}
