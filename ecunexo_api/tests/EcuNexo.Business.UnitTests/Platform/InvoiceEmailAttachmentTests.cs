using System.Text;
using EcuNexo.Api.Endpoints.V1.Billing;

namespace EcuNexo.Business.UnitTests.Platform;

public class InvoiceEmailAttachmentTests
{
    private static string Base64(string text) => Convert.ToBase64String(Encoding.UTF8.GetBytes(text));

    [Fact(DisplayName = "Adjuntos: decodifica PDF y XML válidos y conserva nombre y tipo")]
    public void Verify_Valid_Attachments_Decoded()
    {
        var requested = new List<InvoiceAuthorizedEmailAttachment>
        {
            new("factura-001-002-000000123-ride.pdf", "application/pdf", Base64("%PDF-1.7 ride")),
            new("factura-001-002-000000123.xml", "application/xml", Base64("<factura/>")),
        };

        var ok = InvoiceEmailEndpoints.TryBuildAttachments(requested, out var attachments, out var error);

        Assert.True(ok);
        Assert.Null(error);
        Assert.NotNull(attachments);
        Assert.Equal(2, attachments!.Count);
        Assert.Equal("factura-001-002-000000123-ride.pdf", attachments[0].FileName);
        Assert.Equal("application/pdf", attachments[0].ContentType);
        Assert.Equal(Encoding.UTF8.GetBytes("%PDF-1.7 ride"), attachments[0].Content);
        Assert.Equal("application/xml", attachments[1].ContentType);
    }

    [Fact(DisplayName = "Adjuntos: sin adjuntos es válido y no construye lista")]
    public void Verify_No_Attachments_Is_Valid()
    {
        var ok = InvoiceEmailEndpoints.TryBuildAttachments(null, out var attachments, out var error);

        Assert.True(ok);
        Assert.Null(error);
        Assert.Null(attachments);
    }

    [Theory(DisplayName = "Adjuntos: rechaza tipos MIME no permitidos")]
    [InlineData("application/zip")]
    [InlineData("application/octet-stream")]
    [InlineData("text/html")]
    public void Verify_Rejects_Disallowed_Content_Type(string contentType)
    {
        var requested = new List<InvoiceAuthorizedEmailAttachment>
        {
            new("archivo.bin", contentType, Base64("contenido")),
        };

        var ok = InvoiceEmailEndpoints.TryBuildAttachments(requested, out _, out var error);

        Assert.False(ok);
        Assert.Contains("no permitido", error);
    }

    [Fact(DisplayName = "Adjuntos: rechaza base64 inválido")]
    public void Verify_Rejects_Invalid_Base64()
    {
        var requested = new List<InvoiceAuthorizedEmailAttachment>
        {
            new("factura.pdf", "application/pdf", "%%%no-es-base64%%%"),
        };

        var ok = InvoiceEmailEndpoints.TryBuildAttachments(requested, out _, out var error);

        Assert.False(ok);
        Assert.Contains("base64", error);
    }

    [Fact(DisplayName = "Adjuntos: neutraliza rutas en el nombre del archivo")]
    public void Verify_Sanitizes_File_Name_Path_Traversal()
    {
        var requested = new List<InvoiceAuthorizedEmailAttachment>
        {
            new("../../etc/factura.pdf", "application/pdf", Base64("%PDF")),
        };

        var ok = InvoiceEmailEndpoints.TryBuildAttachments(requested, out var attachments, out _);

        Assert.True(ok);
        Assert.Equal("factura.pdf", attachments![0].FileName);
    }

    [Fact(DisplayName = "Adjuntos: rechaza más de 4 adjuntos por correo")]
    public void Verify_Rejects_Too_Many_Attachments()
    {
        var requested = Enumerable.Range(1, 5)
            .Select(i => new InvoiceAuthorizedEmailAttachment($"factura-{i}.pdf", "application/pdf", Base64("%PDF")))
            .ToList();

        var ok = InvoiceEmailEndpoints.TryBuildAttachments(requested, out _, out var error);

        Assert.False(ok);
        Assert.Contains("Máximo 4", error);
    }
}
