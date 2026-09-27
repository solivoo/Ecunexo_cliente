using System.Globalization;
using System.Net;
using System.Text;
using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Ecommerce;
using Microsoft.Extensions.Logging;

namespace EcuNexo.Business.Ecommerce.Storefront;

/// <summary>
/// Notificaciones por correo del flujo de pedidos de la tienda pública.
/// Se ejecuta en modo best-effort: si falta un destinatario o el envío falla,
/// se registra en el log y no se interrumpe el flujo de negocio.
/// </summary>
public sealed partial class EcommerceOrderEmailNotifier
{
    private const string TeamDisplayName = "Equipo de la tienda";

    private readonly IEmailSender _emailSender;
    private readonly IEcommerceStorefrontSettingsReader _settingsReader;
    private readonly ILogger<EcommerceOrderEmailNotifier> _logger;

    public EcommerceOrderEmailNotifier(
        IEmailSender emailSender,
        IEcommerceStorefrontSettingsReader settingsReader,
        ILogger<EcommerceOrderEmailNotifier> logger)
    {
        _emailSender = emailSender;
        _settingsReader = settingsReader;
        _logger = logger;
    }

    /// <summary>Avisa al equipo de la tienda y al cliente que se registró un pedido nuevo.</summary>
    public async Task NotifyOrderCreatedAsync(
        EcommerceOrder order,
        string? paymentInstructions,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(order);

        try
        {
            var teamEmail = await ResolveTeamEmailAsync(order.TenantId, ct).ConfigureAwait(false);
            await TrySendAsync(
                teamEmail,
                TeamDisplayName,
                $"Nuevo pedido {order.OrderNumber}",
                BuildOrderCreatedTeamText(order, paymentInstructions),
                order.TenantId,
                ct).ConfigureAwait(false);

            await TrySendAsync(
                order.Customer.Email,
                order.Customer.CustomerName,
                $"Pedido recibido · {order.OrderNumber}",
                BuildOrderCreatedClientText(order, paymentInstructions),
                order.TenantId,
                ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogNotificationFailed(_logger, order.OrderNumber, ex);
        }
    }

    /// <summary>Avisa al equipo de la tienda que el cliente subió un comprobante de pago.</summary>
    public async Task NotifyPaymentProofUploadedAsync(EcommerceOrder order, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(order);

        try
        {
            var teamEmail = await ResolveTeamEmailAsync(order.TenantId, ct).ConfigureAwait(false);
            await TrySendAsync(
                teamEmail,
                TeamDisplayName,
                $"Comprobante recibido · {order.OrderNumber}",
                BuildPaymentProofUploadedTeamText(order),
                order.TenantId,
                ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogNotificationFailed(_logger, order.OrderNumber, ex);
        }
    }

    /// <summary>Avisa al cliente que su pago fue confirmado.</summary>
    public async Task NotifyPaymentConfirmedAsync(EcommerceOrder order, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(order);

        try
        {
            await TrySendAsync(
                order.Customer.Email,
                order.Customer.CustomerName,
                $"Pago confirmado · {order.OrderNumber}",
                BuildPaymentConfirmedClientText(order),
                order.TenantId,
                ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogNotificationFailed(_logger, order.OrderNumber, ex);
        }
    }

    /// <summary>Avisa al cliente que su pedido fue despachado.</summary>
    public async Task NotifyOrderShippedAsync(EcommerceOrder order, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(order);

        try
        {
            await TrySendAsync(
                order.Customer.Email,
                order.Customer.CustomerName,
                $"Pedido despachado · {order.OrderNumber}",
                BuildOrderShippedClientText(order),
                order.TenantId,
                ct).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogNotificationFailed(_logger, order.OrderNumber, ex);
        }
    }

    private async Task<string> ResolveTeamEmailAsync(Guid tenantId, CancellationToken ct)
    {
        try
        {
            var settings = await _settingsReader.ResolveAsync(tenantId, ct).ConfigureAwait(false);
            return settings.OrdersNotificationEmail;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogSettingsResolutionFailed(_logger, tenantId, ex);
            return string.Empty;
        }
    }

    private async Task TrySendAsync(
        string? toAddress,
        string displayName,
        string subject,
        string plainTextBody,
        Guid tenantId,
        CancellationToken ct)
    {
        var destination = toAddress?.Trim() ?? string.Empty;
        if (destination.Length == 0)
        {
            LogRecipientMissing(_logger, subject);
            return;
        }

        try
        {
            await _emailSender
                .SendAsync(
                    new EmailMessage(
                        destination,
                        displayName,
                        subject,
                        plainTextBody,
                        BuildHtml(subject, plainTextBody),
                        tenantId),
                    ct)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogSendFailed(_logger, destination, subject, ex);
        }
    }

    private static string BuildOrderCreatedTeamText(EcommerceOrder order, string? paymentInstructions)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Se recibió un nuevo pedido en la tienda online.");
        builder.AppendLine();
        AppendOrderHeader(builder, order);
        AppendItems(builder, order);
        AppendTotals(builder, order);
        AppendShippingSummary(builder, order);
        AppendCustomerNotes(builder, order);
        AppendPaymentInstructions(builder, paymentInstructions);
        return builder.ToString().TrimEnd();
    }

    private static string BuildOrderCreatedClientText(EcommerceOrder order, string? paymentInstructions)
    {
        var builder = new StringBuilder();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Hola {order.Customer.CustomerName},");
        builder.AppendLine();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Recibimos tu pedido {order.OrderNumber} en nuestra tienda online.");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Fecha: {FormatDate(order.OrderDate)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Método de pago: {EcommerceStorefrontLabels.ForPayment(order.PaymentMethod)}");
        builder.AppendLine();
        AppendItems(builder, order);
        AppendTotals(builder, order);
        AppendPaymentInstructions(builder, paymentInstructions);
        builder.AppendLine();
        builder.AppendLine("Gracias por tu compra.");
        return builder.ToString().TrimEnd();
    }

    private static string BuildPaymentProofUploadedTeamText(EcommerceOrder order)
    {
        var builder = new StringBuilder();
        builder.AppendLine("El cliente subió un comprobante de pago para el siguiente pedido.");
        builder.AppendLine();
        AppendOrderHeader(builder, order);
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Comprobante subido: {FormatDate(order.PaymentProofUploadedAtUtc ?? order.UpdatedAt ?? order.OrderDate)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Total: {Money(order.TotalAmount)}");
        builder.AppendLine();
        builder.AppendLine("Revisa la plataforma para confirmar el pago.");
        return builder.ToString().TrimEnd();
    }

    private static string BuildPaymentConfirmedClientText(EcommerceOrder order)
    {
        var builder = new StringBuilder();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Hola {order.Customer.CustomerName},");
        builder.AppendLine();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Confirmamos el pago de tu pedido {order.OrderNumber}.");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Monto acreditado: {Money(order.TotalAmount)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Fecha: {FormatDate(DateTimeOffset.UtcNow)}");
        builder.AppendLine();
        builder.AppendLine("Estamos preparando tu pedido para el despacho.");
        builder.AppendLine();
        builder.AppendLine("Gracias por tu compra.");
        return builder.ToString().TrimEnd();
    }

    private static string BuildOrderShippedClientText(EcommerceOrder order)
    {
        var builder = new StringBuilder();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Hola {order.Customer.CustomerName},");
        builder.AppendLine();
        builder.AppendLine(CultureInfo.InvariantCulture, $"Tu pedido {order.OrderNumber} fue despachado.");
        builder.AppendLine();
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Transportista: {ValueOrFallback(order.Shipping.Carrier, "Por confirmar")}");
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Guía / Tracking: {ValueOrFallback(order.Shipping.TrackingNumber, "Sin tracking")}");
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Dirección de entrega: {order.Shipping.AddressLine1}, {order.Shipping.City}");
        builder.AppendLine();
        builder.AppendLine("Gracias por tu compra.");
        return builder.ToString().TrimEnd();
    }

    private static void AppendOrderHeader(StringBuilder builder, EcommerceOrder order)
    {
        builder.AppendLine(CultureInfo.InvariantCulture, $"Pedido: {order.OrderNumber}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Fecha: {FormatDate(order.OrderDate)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Cliente: {order.Customer.CustomerName} ({order.Customer.TaxId})");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Correo: {order.Customer.Email}");
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Teléfono: {ValueOrFallback(order.Customer.Phone, "No registrado")}");
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Método de pago: {EcommerceStorefrontLabels.ForPayment(order.PaymentMethod)}");
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Método de envío: {EcommerceStorefrontLabels.ForShipping(order.ShippingMethod)}");
        builder.AppendLine();
    }

    private static void AppendItems(StringBuilder builder, EcommerceOrder order)
    {
        builder.AppendLine("Productos:");
        foreach (var item in order.Items)
        {
            var quantity = item.Quantity.ToString("0.####", CultureInfo.InvariantCulture);
            builder.AppendLine(
                CultureInfo.InvariantCulture,
                $"- {quantity} × {item.ItemName} ({item.Sku}): {Money(item.TotalAmount)}");
        }

        builder.AppendLine();
    }

    private static void AppendTotals(StringBuilder builder, EcommerceOrder order)
    {
        builder.AppendLine(CultureInfo.InvariantCulture, $"Subtotal: {Money(order.Subtotal)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"IVA: {Money(order.TaxAmount)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Envío: {Money(order.ShippingCost)}");
        builder.AppendLine(CultureInfo.InvariantCulture, $"Total: {Money(order.TotalAmount)}");
    }

    private static void AppendShippingSummary(StringBuilder builder, EcommerceOrder order)
    {
        builder.AppendLine();
        builder.AppendLine(
            CultureInfo.InvariantCulture,
            $"Dirección de entrega: {order.Shipping.AddressLine1}, {order.Shipping.City}");
    }

    private static void AppendCustomerNotes(StringBuilder builder, EcommerceOrder order)
    {
        if (!string.IsNullOrWhiteSpace(order.CustomerNotes))
        {
            builder.AppendLine(CultureInfo.InvariantCulture, $"Notas del cliente: {order.CustomerNotes.Trim()}");
        }
    }

    private static void AppendPaymentInstructions(StringBuilder builder, string? paymentInstructions)
    {
        if (string.IsNullOrWhiteSpace(paymentInstructions))
        {
            return;
        }

        builder.AppendLine();
        builder.AppendLine("Para completar tu pago:");
        builder.AppendLine(paymentInstructions.Trim());
    }

    private static string BuildHtml(string subject, string plainTextBody)
    {
        var encodedSubject = WebUtility.HtmlEncode(subject);
        var encodedBody = WebUtility.HtmlEncode(plainTextBody);
        return $"""
            <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;">
              <h2 style="color:#0f766e;margin:0 0 12px;">{encodedSubject}</h2>
              <p style="white-space:pre-line;margin:0;">{encodedBody}</p>
            </div>
            """;
    }

    private static string FormatDate(DateTimeOffset value) =>
        value.ToUniversalTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) + " UTC";

    private static string Money(decimal value) =>
        "$" + value.ToString("0.00", CultureInfo.InvariantCulture);

    private static string ValueOrFallback(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    [LoggerMessage(
        EventId = 9201,
        Level = LogLevel.Information,
        Message = "Notificación de pedido omitida: no hay correo destinatario para «{Subject}».")]
    private static partial void LogRecipientMissing(ILogger logger, string subject);

    [LoggerMessage(
        EventId = 9202,
        Level = LogLevel.Warning,
        Message = "No se pudo enviar la notificación «{Subject}» a {ToAddress}. El flujo continúa.")]
    private static partial void LogSendFailed(
        ILogger logger,
        string toAddress,
        string subject,
        Exception ex);

    [LoggerMessage(
        EventId = 9203,
        Level = LogLevel.Warning,
        Message = "No se pudo resolver la configuración de la tienda del tenant {TenantId}; se omite el aviso por correo.")]
    private static partial void LogSettingsResolutionFailed(
        ILogger logger,
        Guid tenantId,
        Exception ex);

    [LoggerMessage(
        EventId = 9204,
        Level = LogLevel.Warning,
        Message = "Falló el envío de notificaciones del pedido {OrderNumber}. El flujo continúa.")]
    private static partial void LogNotificationFailed(
        ILogger logger,
        string orderNumber,
        Exception ex);
}
