namespace EcuNexo.Business.Abstractions;

/// <summary>Envío de correo transaccional (implementación en Api).</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

public sealed record EmailMessage(
    string ToAddress,
    string ToDisplayName,
    string Subject,
    string PlainTextBody);
