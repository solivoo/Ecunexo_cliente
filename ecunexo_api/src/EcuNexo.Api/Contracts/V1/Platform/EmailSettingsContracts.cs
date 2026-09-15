namespace EcuNexo.Api.Contracts.V1.Platform;

public sealed record EmailSettingsResponse(
    bool IsEnabled,
    string Host,
    int Port,
    bool UseSsl,
    string UserName,
    string SenderEmail,
    string SenderName,
    bool HasPassword,
    bool IsCustom = false,
    string Scope = "Global");

public sealed record UpdateEmailSettingsRequest(
    bool IsEnabled,
    string Host,
    int Port,
    bool UseSsl,
    string UserName,
    string? Password,
    string SenderEmail,
    string SenderName);

public sealed record TestEmailSettingsRequest(
    string TargetEmail,
    string? Host = null,
    int? Port = null,
    bool? UseSsl = null,
    string? UserName = null,
    string? Password = null,
    string? SenderEmail = null,
    string? SenderName = null);

public sealed record TestEmailSettingsResponse(
    bool Success,
    string Message);
