namespace EcuNexo.Core.Platform;

/// <summary>Códigos de configuración del motor de correo persistidos en <c>platform.sys_settings</c>.</summary>
public static class EmailSettingCodes
{
    public const string SmtpConfig = "system.email.smtp";
}

public enum SmtpEncryptionMode
{
    Auto = 0,
    SslTls = 1,
    StartTls = 2,
    None = 3,
}

/// <summary>Parámetros de conexión y autenticación para el servidor SMTP (ej. Zoho Mail).</summary>
public sealed record EmailSmtpConfig
{
    public bool IsEnabled { get; init; } = true;

    public string Host { get; init; } = "smtp.zoho.com";

    public int Port { get; init; } = 465;

    public bool UseSsl { get; init; } = true;

    public SmtpEncryptionMode EncryptionMode { get; init; } = SmtpEncryptionMode.Auto;

    public string UserName { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string SenderEmail { get; init; } = string.Empty;

    public string SenderName { get; init; } = "EcuNexo";
}
