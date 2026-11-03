using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
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

    private const int MaxAttachmentCount = 4;
    private const int MaxAttachmentBytes = 4 * 1024 * 1024;
    private const int MaxTotalAttachmentBytes = 5 * 1024 * 1024;

    private static readonly HashSet<string> AllowedAttachmentContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/xml",
        "text/xml",
    };

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
        // Permitir tanto llamada autenticada por JWT desde el admin/POS como API key interna de billing
        var expectedKey = configuration["InvoiceEmail:ApiKey"];
        var hasBillingKeyHeader = httpContext.Request.Headers.TryGetValue(BillingKeyHeader, out var receivedKey);
        var hasValidBillingKey = !string.IsNullOrWhiteSpace(expectedKey)
            && hasBillingKeyHeader
            && receivedKey.FirstOrDefault() == expectedKey;
        var isAuthenticatedUser = httpContext.User.Identity?.IsAuthenticated == true;

        if (!string.IsNullOrWhiteSpace(expectedKey) && !hasValidBillingKey && !isAuthenticatedUser)
        {
            return Results.Unauthorized();
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

        if (!TryBuildAttachments(request.Attachments, out var attachments, out var attachmentError))
        {
            return Results.BadRequest(new { error = attachmentError });
        }

        if (attachments is not { Count: > 0 })
        {
            if (hasBillingKeyHeader)
            {
                return Results.Ok(new
                {
                    sent = false,
                    skipped = true,
                    reason = "Notificación interna sin adjuntos omitida; el correo al cliente requiere XML y RIDE PDF."
                });
            }

            return Results.BadRequest(new
            {
                error = "El correo al cliente debe incluir obligatoriamente el archivo XML y el RIDE (PDF)."
            });
        }

        if (!HasRequiredSriAttachmentPair(attachments, out var pairError))
        {
            return Results.BadRequest(new { error = pairError });
        }

        try
        {
            await emailSender.SendAsync(
                new EmailMessage(
                    ToAddress: request.CounterpartyEmail.Trim(),
                    ToDisplayName: request.CounterpartyName.Trim(),
                    Subject: renderedSubject,
                    PlainTextBody: plainBody,
                    HtmlBody: renderedBody,
                    TenantId: tenantId,
                    Attachments: attachments),
                ct).ConfigureAwait(false);

            LogEmailSent(logger, request.CounterpartyEmail.Trim(), tenantId, request.BillingInvoiceId, null);

            return Results.Ok(new
            {
                sent = true,
                to = request.CounterpartyEmail.Trim(),
                attachments = attachments?.Select(a => a.FileName).ToArray() ?? []
            });
        }
        catch (Exception ex)
        {
            LogEmailError(logger, request.BillingInvoiceId, ex);
            return Results.Problem($"Error enviando correo: {ex.Message}");
        }
    }

    /// <summary>
    /// Decodifica y valida los adjuntos base64 (RIDE PDF y XML firmado/autorizado).
    /// Restringe cantidad, tamaño y tipos MIME para evitar abuso del endpoint.
    /// </summary>
    internal static bool TryBuildAttachments(
        IReadOnlyList<InvoiceAuthorizedEmailAttachment>? requested,
        out List<EmailAttachment>? attachments,
        out string? error)
    {
        attachments = null;
        error = null;

        if (requested is not { Count: > 0 })
        {
            return true;
        }

        if (requested.Count > MaxAttachmentCount)
        {
            error = $"Máximo {MaxAttachmentCount} adjuntos por correo.";
            return false;
        }

        var decoded = new List<EmailAttachment>(requested.Count);
        var totalBytes = 0;

        foreach (var item in requested)
        {
            if (string.IsNullOrWhiteSpace(item.FileName) || string.IsNullOrWhiteSpace(item.ContentBase64))
            {
                error = "Cada adjunto requiere fileName y contentBase64.";
                return false;
            }

            var contentType = item.ContentType?.Trim() ?? string.Empty;
            if (!AllowedAttachmentContentTypes.Contains(contentType))
            {
                error = $"Tipo de adjunto no permitido: {item.ContentType}. Solo se aceptan PDF y XML.";
                return false;
            }

            var safeName = Path.GetFileName(item.FileName.Trim());
            if (string.IsNullOrWhiteSpace(safeName) || safeName.Length > 160)
            {
                error = "El nombre del adjunto no es válido.";
                return false;
            }

            byte[] content;
            try
            {
                content = Convert.FromBase64String(item.ContentBase64);
            }
            catch (FormatException)
            {
                error = $"El adjunto «{safeName}» no contiene base64 válido.";
                return false;
            }

            if (content.Length == 0)
            {
                error = $"El adjunto «{safeName}» está vacío.";
                return false;
            }

            if (content.Length > MaxAttachmentBytes)
            {
                error = $"El adjunto «{safeName}» supera el máximo de {MaxAttachmentBytes / (1024 * 1024)} MB.";
                return false;
            }

            totalBytes += content.Length;
            if (totalBytes > MaxTotalAttachmentBytes)
            {
                error = $"Los adjuntos superan el máximo total de {MaxTotalAttachmentBytes / (1024 * 1024)} MB.";
                return false;
            }

            if (string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            {
                if (!IsValidPdfPayload(content))
                {
                    error = $"El adjunto «{safeName}» no tiene una cabecera PDF válida (%PDF).";
                    return false;
                }
            }
            else if (!IsValidSriXmlPayload(content, safeName, out var xmlError))
            {
                error = xmlError;
                return false;
            }

            decoded.Add(new EmailAttachment(safeName, contentType, content));
        }

        attachments = decoded;
        return true;
    }

    internal static bool HasRequiredSriAttachmentPair(
        IReadOnlyList<EmailAttachment>? attachments,
        out string? error)
    {
        error = null;
        if (attachments is not { Count: >= 2 })
        {
            error = "El correo al cliente debe adjuntar tanto el XML autorizado como el RIDE en PDF.";
            return false;
        }

        var hasPdf = attachments.Any(a =>
            string.Equals(a.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase));
        var hasXml = attachments.Any(a =>
            string.Equals(a.ContentType, "application/xml", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(a.ContentType, "text/xml", StringComparison.OrdinalIgnoreCase));

        if (!hasPdf || !hasXml)
        {
            error = "El correo al cliente requiere al menos un archivo RIDE (application/pdf) y un archivo XML (application/xml).";
            return false;
        }

        return true;
    }

    private static bool IsValidPdfPayload(ReadOnlySpan<byte> content) =>
        content.Length >= 4
        && content[0] == (byte)'%'
        && content[1] == (byte)'P'
        && content[2] == (byte)'D'
        && content[3] == (byte)'F';

    private static readonly HashSet<string> AllowedSriXmlRoots = new(StringComparer.Ordinal)
    {
        "autorizacion",
        "factura",
        "notaCredito",
        "liquidacionCompra",
        "comprobanteRetencion",
        "guiaRemision",
    };

    private static bool IsValidSriXmlPayload(byte[] content, string fileName, out string? error)
    {
        error = null;
        try
        {
            var xmlText = Encoding.UTF8.GetString(content).TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
            var doc = XDocument.Parse(xmlText, LoadOptions.PreserveWhitespace);
            var root = doc.Root;
            if (root is null || !AllowedSriXmlRoots.Contains(root.Name.LocalName))
            {
                error = $"El XML «{fileName}» no tiene un nodo raíz SRI válido (<autorizacion>, <factura> o <notaCredito>).";
                return false;
            }

            if (string.Equals(root.Name.LocalName, "autorizacion", StringComparison.Ordinal))
            {
                var estado = root.Element("estado")?.Value?.Trim();
                var numeroAutorizacion = root.Element("numeroAutorizacion")?.Value?.Trim();
                var comprobante = root.Element("comprobante")?.Value?.Trim();
                if (string.IsNullOrWhiteSpace(estado)
                    || string.IsNullOrWhiteSpace(numeroAutorizacion)
                    || string.IsNullOrWhiteSpace(comprobante))
                {
                    error = $"El XML «{fileName}» con raíz <autorizacion> debe contener <estado>, <numeroAutorizacion> y <comprobante>.";
                    return false;
                }
            }

            return true;
        }
        catch (XmlException)
        {
            error = $"El adjunto «{fileName}» no contiene un documento XML bien formado.";
            return false;
        }
    }
}

public sealed record InvoiceAuthorizedEmailAttachment(
    string FileName,
    string ContentType,
    string ContentBase64);

public sealed record InvoiceAuthorizedEmailRequest(
    Guid BillingInvoiceId,
    string CounterpartyEmail,
    string CounterpartyName,
    string DocumentType,
    string SerieSecuencial,
    string? AccessKey,
    decimal GrandTotal,
    IReadOnlyList<InvoiceAuthorizedEmailAttachment>? Attachments = null);
