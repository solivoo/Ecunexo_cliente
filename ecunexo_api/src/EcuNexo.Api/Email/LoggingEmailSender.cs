using EcuNexo.Business.Abstractions;

namespace EcuNexo.Api.Email;

/// <summary>
/// Sender de desarrollo: escribe el correo en el log (sin SMTP).
/// Sustituible por un adaptador SMTP cuando haya configuración.
/// </summary>
public sealed partial class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        LogEmail(_logger, message.ToAddress, message.ToDisplayName, message.Subject, message.PlainTextBody);
        return Task.CompletedTask;
    }

    [LoggerMessage(
        EventId = 9101,
        Level = LogLevel.Information,
        Message = "Email → To={ToAddress} ({ToDisplayName}) | Subject={Subject} | Body={Body}")]
    private static partial void LogEmail(
        ILogger logger,
        string toAddress,
        string toDisplayName,
        string subject,
        string body);
}
