using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Business.Abstractions;

namespace EcuNexo.Api.Endpoints.V1.Billing;

public static class InvoiceEmailEndpoints
{
    private const string BillingKeyHeader = "X-EcuNexo-Billing-Key";

    // LoggerMessage delegates para evitar CA1848 / CA1873
    private static readonly Action<ILogger, string, Guid, Guid, Exception?> LogEmailSent =
        LoggerMessage.Define<string, Guid, Guid>(
            LogLevel.Information,
            new EventId(1, "InvoiceEmailSent"),
            "Correo de factura autorizada enviado a {Email} para tenant {TenantId} factura {InvoiceId}");

    private static readonly Action<ILogger, Guid, Exception?> LogEmailError =
        LoggerMessage.Define<Guid>(
            LogLevel.Error,
            new EventId(2, "InvoiceEmailError"),
            "Error enviando correo de factura {InvoiceId}");

    public static WebApplication MapInvoiceEmailEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        app.MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/billing")
            .WithApiVersionSet(versionSet)
            .WithTags("Billing")
            .MapPost("/invoice-authorized-email", SendInvoiceAuthorizedEmailAsync);

        return app;
    }

    private static async Task<IResult> SendInvoiceAuthorizedEmailAsync(
        Guid tenantId,
        InvoiceAuthorizedEmailRequest request,
        IEmailSender emailSender,
        IConfiguration configuration,
        ILogger<Program> logger,
        HttpContext httpContext,
        CancellationToken ct)
    {
        // Validar API key interna de billing
        var expectedKey = configuration["InvoiceEmail:ApiKey"];
        if (!string.IsNullOrWhiteSpace(expectedKey))
        {
            if (!httpContext.Request.Headers.TryGetValue(BillingKeyHeader, out var receivedKey)
                || receivedKey.FirstOrDefault() != expectedKey)
            {
                return Results.Unauthorized();
            }
        }

        if (string.IsNullOrWhiteSpace(request.CounterpartyEmail))
        {
            return Results.BadRequest(new { error = "El correo del cliente es obligatorio." });
        }

        var docTypeLabel = request.DocumentType switch
        {
            "01" => "Factura Electrónica",
            "04" => "Nota de Crédito",
            "03" => "Liquidación de Compra",
            _ => "Comprobante Electrónico"
        };

        var subject = $"{docTypeLabel} #{request.SerieSecuencial} — Autorizada por el SRI";

        var accessKeyHtml = string.IsNullOrWhiteSpace(request.AccessKey)
            ? ""
            : $"<p style=\"margin:4px 0;font-size:11px;color:#64748b;\"><strong>Clave de Acceso:</strong> {request.AccessKey}</p>";

        var htmlBody = $"""
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
              <h2 style="color:#0284c7;margin-top:0">Su {docTypeLabel} ha sido autorizada</h2>
              <p style="font-size:15px;line-height:1.6;color:#334155;">
                Estimado/a <strong>{request.CounterpartyName}</strong>,<br/>
                Su comprobante electrónico ha sido procesado y autorizado exitosamente por el SRI de Ecuador.
              </p>
              <div style="background:#f8fafc;border-left:4px solid #0284c7;padding:12px 16px;margin:16px 0;border-radius:4px;">
                <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>Tipo:</strong> {docTypeLabel}</p>
                <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>Número:</strong> {request.SerieSecuencial}</p>
                <p style="margin:4px 0;font-size:13px;color:#475569;"><strong>Total:</strong> $ {request.GrandTotal:N2}</p>
                {accessKeyHtml}
              </div>
              <p style="font-size:13px;color:#64748b;">Este correo es generado automáticamente por el sistema EcuNexo. Si tiene alguna consulta, contáctenos.</p>
            </div>
            """;

        var plainBody = $"Estimado/a {request.CounterpartyName},\n\nSu {docTypeLabel} #{request.SerieSecuencial} ha sido autorizada por el SRI.\nTotal: $ {request.GrandTotal:N2}\nClave de Acceso: {request.AccessKey}\n\nEste correo es generado automáticamente por EcuNexo.";

        try
        {
            await emailSender.SendAsync(
                new EmailMessage(
                    ToAddress: request.CounterpartyEmail,
                    ToDisplayName: request.CounterpartyName,
                    Subject: subject,
                    PlainTextBody: plainBody,
                    HtmlBody: htmlBody,
                    TenantId: tenantId),
                ct).ConfigureAwait(false);

            LogEmailSent(logger, request.CounterpartyEmail, tenantId, request.BillingInvoiceId, null);

            return Results.Ok(new { sent = true, to = request.CounterpartyEmail });
        }
        catch (Exception ex)
        {
            LogEmailError(logger, request.BillingInvoiceId, ex);
            return Results.Problem($"Error enviando correo: {ex.Message}");
        }
    }
}

public sealed record InvoiceAuthorizedEmailRequest(
    Guid BillingInvoiceId,
    string CounterpartyEmail,
    string CounterpartyName,
    string DocumentType,
    string SerieSecuencial,
    string? AccessKey,
    decimal GrandTotal);
