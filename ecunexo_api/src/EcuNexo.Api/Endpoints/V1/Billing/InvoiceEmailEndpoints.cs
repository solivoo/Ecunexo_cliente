using System.Globalization;
using System.Text.Json;
using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Email;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Platform;

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
        ISysSettingRepository settingRepository,
        ITenantRepository tenantRepository,
        IConfiguration configuration,
        ILogger<Program> logger,
        HttpContext httpContext,
        CancellationToken ct)
    {
        // Validar API key interna de billing si existe
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

        // Obtener datos del tenant para la plantilla
        var tenantObj = await tenantRepository.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        var tenantName = tenantObj?.Name ?? "EcuNexo";
        var tenantRuc = tenantObj?.TaxId ?? string.Empty;

        // 1. Obtener plantilla personalizada (o predeterminada) para sri.invoice.authorized
        var templateSettingCode = EmailTemplateCatalog.GetSettingCode("sri.invoice.authorized");
        var savedSetting = await settingRepository
            .GetAsync(templateSettingCode, SettingScope.Tenant, tenantId.ToString("D"), ct)
            .ConfigureAwait(false);

        var defaultTpl = EmailTemplateCatalog.DefaultTemplates.FirstOrDefault(t => t.ActionCode == "sri.invoice.authorized");
        string subjectTpl = defaultTpl?.DefaultSubject ?? $"{docTypeLabel} #{{FacturaNumero}} — {{TenantName}}";
        string bodyTpl = defaultTpl?.DefaultBodyHtml ?? $"<p>Estimado/a {{ClienteNombre}}, su comprobante #{{FacturaNumero}} por ${{MontoTotal}} ha sido autorizado por el SRI.</p>";

        if (savedSetting is not null && !string.IsNullOrWhiteSpace(savedSetting.ValueJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(savedSetting.ValueJson);
                if (doc.RootElement.TryGetProperty("Subject", out var s) && !string.IsNullOrWhiteSpace(s.GetString()))
                {
                    subjectTpl = s.GetString()!;
                }
                if (doc.RootElement.TryGetProperty("BodyHtml", out var b) && !string.IsNullOrWhiteSpace(b.GetString()))
                {
                    bodyTpl = b.GetString()!;
                }
            }
            catch
            {
                /* fallback a template default */
            }
        }

        var placeholders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["{{ClienteNombre}}"] = !string.IsNullOrWhiteSpace(request.CounterpartyName) ? request.CounterpartyName.Trim() : "Cliente",
            ["{{FacturaNumero}}"] = request.SerieSecuencial,
            ["{{MontoTotal}}"] = request.GrandTotal.ToString("N2", CultureInfo.InvariantCulture),
            ["{{FechaEmision}}"] = DateTime.UtcNow.ToString("dd/MMM/yyyy", CultureInfo.InvariantCulture),
            ["{{ClaveAcceso}}"] = request.AccessKey ?? string.Empty,
            ["{{TenantName}}"] = tenantName,
            ["{{TenantRuc}}"] = tenantRuc,
        };

        var (renderedSubject, renderedBody) = EmailTemplateRenderer.Render("sri.invoice.authorized", subjectTpl, bodyTpl, placeholders);
        var plainBody = $"Estimado/a {request.CounterpartyName},\n\nSu {docTypeLabel} #{request.SerieSecuencial} ha sido autorizada por el SRI.\nTotal: $ {request.GrandTotal.ToString("N2", CultureInfo.InvariantCulture)}\nClave de Acceso: {request.AccessKey}\n\nEste correo es generado automáticamente por {tenantName}.";

        try
        {
            await emailSender.SendAsync(
                new EmailMessage(
                    ToAddress: request.CounterpartyEmail.Trim(),
                    ToDisplayName: request.CounterpartyName.Trim(),
                    Subject: renderedSubject,
                    PlainTextBody: plainBody,
                    HtmlBody: renderedBody,
                    TenantId: tenantId),
                ct).ConfigureAwait(false);

            LogEmailSent(logger, request.CounterpartyEmail.Trim(), tenantId, request.BillingInvoiceId, null);

            return Results.Ok(new { sent = true, to = request.CounterpartyEmail.Trim() });
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
