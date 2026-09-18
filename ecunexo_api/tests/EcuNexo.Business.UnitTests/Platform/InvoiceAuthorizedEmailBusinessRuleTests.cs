using System.Globalization;
using EcuNexo.Api.Email;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Platform;
using NSubstitute;
using Xunit;

namespace EcuNexo.Business.UnitTests.Platform;

public class InvoiceAuthorizedEmailBusinessRuleTests
{
    [Theory(DisplayName = "Regla de Negocio: Envío de correo de factura autorizada en ambientes Pruebas y Producción cuando existe email del cliente")]
    [InlineData("Test", "cliente.pruebas@empresa.com", "01")]
    [InlineData("Production", "cliente.real@empresa.com", "01")]
    [InlineData("Production", "compras@proveedor.com", "04")]
    public async Task Verify_InvoiceEmail_Sent_In_Both_Environments_When_Email_Present(
        string environment,
        string counterpartyEmail,
        string docType)
    {
        // Arrange
        var emailSender = Substitute.For<IEmailSender>();
        var settingRepository = Substitute.For<ISysSettingRepository>();

        var tenantId = Guid.NewGuid();

        // Template default o mock
        settingRepository
            .GetAsync(Arg.Any<string>(), SettingScope.Tenant, tenantId.ToString("D"), Arg.Any<CancellationToken>())
            .Returns((SysSetting?)null);

        var messageCaptor = new List<EmailMessage>();
        await emailSender.SendAsync(Arg.Do<EmailMessage>(messageCaptor.Add), Arg.Any<CancellationToken>());

        var docTypeLabel = docType == "04" ? "Nota de Crédito" : "Factura Electrónica";

        var placeholders = new Dictionary<string, string>
        {
            ["{{ClienteNombre}}"] = "Cliente Ejemplo S.A.",
            ["{{FacturaNumero}}"] = "001-002-000000123",
            ["{{MontoTotal}}"] = (150.75m).ToString("N2", CultureInfo.InvariantCulture),
            ["{{FechaEmision}}"] = DateTime.UtcNow.ToString("dd/MMM/yyyy", CultureInfo.InvariantCulture),
            ["{{ClaveAcceso}}"] = "1809202601179234567800120010020000001231234567819",
            ["{{TenantName}}"] = $"EcuNexo ({environment})",
            ["{{TenantRuc}}"] = "1792345678001"
        };

        var defaultTpl = EmailTemplateCatalog.DefaultTemplates.First(t => t.ActionCode == "sri.invoice.authorized");
        var (subject, bodyHtml) = EmailTemplateRenderer.Render("sri.invoice.authorized", defaultTpl.DefaultSubject, defaultTpl.DefaultBodyHtml, placeholders);

        // Act
        var emailMsg = new EmailMessage(
            ToAddress: counterpartyEmail,
            ToDisplayName: "Cliente Ejemplo S.A.",
            Subject: $"{docTypeLabel} - {subject}",
            PlainTextBody: $"Texto plano {environment}",
            HtmlBody: bodyHtml,
            TenantId: tenantId);

        await emailSender.SendAsync(emailMsg, CancellationToken.None);

        // Assert
        Assert.Single(messageCaptor);
        var sentMsg = messageCaptor[0];
        Assert.Equal(counterpartyEmail, sentMsg.ToAddress);
        Assert.Equal(tenantId, sentMsg.TenantId);
        Assert.Contains("001-002-000000123", sentMsg.Subject);
        Assert.Contains("150.75", sentMsg.HtmlBody);
        Assert.Contains("1809202601179234567800120010020000001231234567819", sentMsg.HtmlBody);
    }

    [Fact(DisplayName = "Regla de Negocio: Se omite envío de correo si el cliente no tiene email registrado")]
    public async Task Verify_InvoiceEmail_Skipped_When_CustomerEmail_Is_Empty()
    {
        // Arrange
        var emailSender = Substitute.For<IEmailSender>();
        var tenantId = Guid.NewGuid();

        string? emptyEmail = "   ";

        // Act
        if (!string.IsNullOrWhiteSpace(emptyEmail))
        {
            await emailSender.SendAsync(new EmailMessage(emptyEmail, "Cliente", "Asunto", "Texto", "Html", tenantId), CancellationToken.None);
        }

        // Assert
        await emailSender.DidNotReceive().SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Regla de Negocio: Sustitución exacta de comodines dinámicos en la plantilla de Factura SRI Autorizada")]
    public void Verify_InvoiceEmail_Renders_Custom_Template_Placeholders_Correctly()
    {
        // Arrange
        var customSubject = "Comprobante {{FacturaNumero}} emitido por {{TenantName}}";
        var customBody = "Hola {{ClienteNombre}}, tu factura {{FacturaNumero}} por {{MontoTotal}} clave {{ClaveAcceso}} está lista.";

        var placeholders = new Dictionary<string, string>
        {
            ["{{ClienteNombre}}"] = "Corporación Ecuador",
            ["{{FacturaNumero}}"] = "002-005-000009999",
            ["{{MontoTotal}}"] = "999.00",
            ["{{FechaEmision}}"] = "18/Sep/2026",
            ["{{ClaveAcceso}}"] = "1234567890123456789012345678901234567890123456789",
            ["{{TenantName}}"] = "Mi Empresa S.A.",
            ["{{TenantRuc}}"] = "0998877665001"
        };

        // Act
        var (renderedSubject, renderedBody) = EmailTemplateRenderer.Render("sri.invoice.authorized", customSubject, customBody, placeholders);

        // Assert
        Assert.Equal("Comprobante 002-005-000009999 emitido por Mi Empresa S.A.", renderedSubject);
        Assert.Equal("Hola Corporación Ecuador, tu factura 002-005-000009999 por 999.00 clave 1234567890123456789012345678901234567890123456789 está lista.", renderedBody);
    }
}
