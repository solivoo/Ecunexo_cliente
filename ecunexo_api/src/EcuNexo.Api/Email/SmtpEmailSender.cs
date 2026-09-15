using System.Text;
using System.Text.Json;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Platform;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace EcuNexo.Api.Email;

/// <summary>
/// Motor de correo electrónico transaccional basado en SMTP (ej. Zoho Mail).
/// Recupera la configuración desde <c>platform.sys_settings</c> (scope Global)
/// o variables de entorno de respaldo.
/// </summary>
public sealed partial class SmtpEmailSender : IEmailSender
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ISysSettingRepository _settingRepository;
    private readonly ITenantContext _tenantContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(
        ISysSettingRepository settingRepository,
        ITenantContext tenantContext,
        IConfiguration configuration,
        ILogger<SmtpEmailSender> logger)
    {
        _settingRepository = settingRepository;
        _tenantContext = tenantContext;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        var config = await GetEffectiveConfigAsync(ct, message.TenantId).ConfigureAwait(false);
        if (config is null || !config.IsEnabled || string.IsNullOrWhiteSpace(config.Host))
        {
            LogSmtpSkipped(_logger, message.ToAddress, message.Subject);
            return;
        }

        var logProtocol = _configuration.GetValue("Smtp:ProtocolLogEnabled", false);
        await SendMimeMessageAsync(config, message.ToAddress, message.ToDisplayName, message.Subject, message.PlainTextBody, message.HtmlBody, ct, logProtocol)
            .ConfigureAwait(false);
    }

    public async Task<EmailSmtpConfig?> GetEffectiveConfigAsync(CancellationToken ct, Guid? tenantId = null)
    {
        // 1. Si hay tenant activo (o explícito), buscar primero su motor de correo propio
        var effectiveTenantId = tenantId ?? _tenantContext.CurrentTenantId;
        if (effectiveTenantId is { } tid && tid != Guid.Empty)
        {
            var tenantSetting = await _settingRepository
                .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Tenant, tid.ToString("D"), ct)
                .ConfigureAwait(false);

            if (tenantSetting is not null && !string.IsNullOrWhiteSpace(tenantSetting.ValueJson))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<EmailSmtpConfig>(tenantSetting.ValueJson, JsonOptions);
                    if (parsed is not null && parsed.IsEnabled && !string.IsNullOrWhiteSpace(parsed.Host))
                    {
                        return parsed;
                    }
                }
                catch (JsonException ex)
                {
                    LogCorruptedSetting(_logger, $"{EmailSettingCodes.SmtpConfig}:tenant:{tid}", ex);
                }
            }
        }

        // 2. Fallback de plataforma: sys_settings con scope Global (motor universal EcuNexo)
        var globalSetting = await _settingRepository
            .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Global, null, ct)
            .ConfigureAwait(false);

        if (globalSetting is not null && !string.IsNullOrWhiteSpace(globalSetting.ValueJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<EmailSmtpConfig>(globalSetting.ValueJson, JsonOptions);
                if (parsed is not null && parsed.IsEnabled && !string.IsNullOrWhiteSpace(parsed.Host))
                {
                    return parsed;
                }
            }
            catch (JsonException ex)
            {
                LogCorruptedSetting(_logger, EmailSettingCodes.SmtpConfig, ex);
            }
        }

        // 2. Respaldo opcional vía configuración / variables de entorno
        var envHost = _configuration["Smtp:Host"] ?? _configuration["SMTP_HOST"];
        if (!string.IsNullOrWhiteSpace(envHost))
        {
            var envPortStr = _configuration["Smtp:Port"] ?? _configuration["SMTP_PORT"];
            _ = int.TryParse(envPortStr, out var envPort);
            if (envPort <= 0)
            {
                envPort = 465;
            }

            var envUseSslStr = _configuration["Smtp:UseSsl"] ?? _configuration["SMTP_USE_SSL"];
            var envUseSsl = !string.Equals(envUseSslStr, "false", StringComparison.OrdinalIgnoreCase);

            return new EmailSmtpConfig
            {
                IsEnabled = true,
                Host = envHost,
                Port = envPort,
                UseSsl = envUseSsl,
                UserName = _configuration["Smtp:UserName"] ?? _configuration["SMTP_USERNAME"] ?? string.Empty,
                Password = _configuration["Smtp:Password"] ?? _configuration["SMTP_PASSWORD"] ?? string.Empty,
                SenderEmail = _configuration["Smtp:SenderEmail"] ?? _configuration["SMTP_SENDER_EMAIL"] ?? string.Empty,
                SenderName = _configuration["Smtp:SenderName"] ?? _configuration["SMTP_SENDER_NAME"] ?? "EcuNexo",
            };
        }

        return null;
    }

    public static async Task SendMimeMessageAsync(
        EmailSmtpConfig config,
        string toAddress,
        string toDisplayName,
        string subject,
        string plainTextBody,
        string? htmlBody,
        CancellationToken ct,
        bool logProtocol = false)
    {
        // Logger temporal de protocolo SMTP para diagnosticar problemas de autenticación.
        // En desarrollo se activa con Smtp:ProtocolLogEnabled=true.
        MemoryStream? protocolStream = logProtocol ? new MemoryStream() : null;
        ProtocolLogger? protocolLogger = protocolStream is not null ? new ProtocolLogger(protocolStream) : null;

        try
        {
            using var client = protocolLogger is not null
                ? new SmtpClient(protocolLogger)
                : new SmtpClient();

            // Opciones SSL/TLS:
            // Puerto 465 -> SSL directo (SslOnConnect)
            // Puerto 587 -> STARTTLS
            // Otros puertos -> según UseSsl
            var secureOption = ResolveSecureSocketOptions(config.Port, config.UseSsl);

            await client.ConnectAsync(config.Host, config.Port, secureOption, ct).ConfigureAwait(false);

            if (!string.IsNullOrWhiteSpace(config.UserName) && !string.IsNullOrWhiteSpace(config.Password))
            {
                await client.AuthenticateAsync(config.UserName, config.Password, ct).ConfigureAwait(false);
            }

            var mime = new MimeMessage();
            var fromEmail = !string.IsNullOrWhiteSpace(config.SenderEmail) ? config.SenderEmail : config.UserName;
            var fromName = !string.IsNullOrWhiteSpace(config.SenderName) ? config.SenderName : "EcuNexo";

            mime.From.Add(new MailboxAddress(fromName, fromEmail));
            mime.To.Add(new MailboxAddress(toDisplayName, toAddress));
            mime.Subject = subject;

            var bodyBuilder = new BodyBuilder();
            if (!string.IsNullOrWhiteSpace(htmlBody))
            {
                bodyBuilder.HtmlBody = htmlBody;
                if (!string.IsNullOrWhiteSpace(plainTextBody))
                {
                    bodyBuilder.TextBody = plainTextBody;
                }
            }
            else
            {
                bodyBuilder.TextBody = plainTextBody;
            }

            mime.Body = bodyBuilder.ToMessageBody();

            await client.SendAsync(mime, ct).ConfigureAwait(false);
            await client.DisconnectAsync(true, ct).ConfigureAwait(false);
        }
        finally
        {
            protocolLogger?.Dispose();

            if (protocolStream is not null)
            {
                protocolStream.Position = 0;
                var logText = Encoding.ASCII.GetString(protocolStream.ToArray());
                if (!string.IsNullOrWhiteSpace(logText))
                {
                    Console.WriteLine("[SMTP PROTOCOL LOG]");
                    Console.WriteLine(logText);
                }

                await protocolStream.DisposeAsync().ConfigureAwait(false);
            }
        }
    }

    public static SecureSocketOptions ResolveSecureSocketOptions(int port, bool useSsl)
    {
        if (!useSsl)
        {
            return SecureSocketOptions.None;
        }

        if (port == 465)
        {
            return SecureSocketOptions.SslOnConnect;
        }

        if (port == 587)
        {
            return SecureSocketOptions.StartTls;
        }

        return SecureSocketOptions.Auto;
    }

    [LoggerMessage(
        EventId = 9102,
        Level = LogLevel.Information,
        Message = "SMTP no está configurado o está deshabilitado. Omitiendo envío a {ToAddress} ({Subject})")]
    private static partial void LogSmtpSkipped(
        ILogger logger,
        string toAddress,
        string subject);

    [LoggerMessage(
        EventId = 9103,
        Level = LogLevel.Warning,
        Message = "JSON corrupto en setting {Code}")]
    private static partial void LogCorruptedSetting(
        ILogger logger,
        string code,
        Exception ex);
}
