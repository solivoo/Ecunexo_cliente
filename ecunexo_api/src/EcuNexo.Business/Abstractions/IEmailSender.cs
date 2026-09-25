namespace EcuNexo.Business.Abstractions;

/// <summary>Envío de correo transaccional (implementación en Api).</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

/// <summary>Adjunto binario para un correo transaccional.</summary>
public sealed record EmailAttachment(
    string FileName,
    string ContentType,
    byte[] Content);

public sealed record EmailMessage(
    string ToAddress,
    string ToDisplayName,
    string Subject,
    string PlainTextBody,
    string? HtmlBody = null,
    Guid? TenantId = null,
    IReadOnlyList<EmailAttachment>? Attachments = null);
