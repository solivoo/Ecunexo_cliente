using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Platform;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;
using EcuNexo.Business.Platform.Queries.GetResolvedSettings;

using System.Text.Json;
using EcuNexo.Api.Email;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Platform;

namespace EcuNexo.Api.Endpoints.V1.Platform;

public static class SettingsEndpoints
{
    public static WebApplication MapSettingsEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder me = app
            .MapGroup("/api/v{version:apiVersion}/settings")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        me.MapGet("", GetResolvedSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.read", "tenancy.tenant.read"));
        me.MapPut("/ui", UpsertUiPreferencesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));

        RouteGroupBuilder email = app
            .MapGroup("/api/v{version:apiVersion}/settings/email")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        email.MapGet("", GetEmailSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.read", "tenancy.tenant.read"));
        email.MapPut("", UpdateEmailSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));
        email.MapPost("/test", TestEmailSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));

        RouteGroupBuilder tenant = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        tenant.MapGet("/settings", GetTenantSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.read", "tenancy.tenant.read"));

        return app;
    }

    private static async Task<IResult> GetResolvedSettingsAsync(
        ICallerContext caller,
        ITenantContext tenant,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .AskAsync<GetResolvedSettingsQuery, GetResolvedSettingsResponse>(
                new GetResolvedSettingsQuery(
                    userId,
                    tenant.CurrentTenantId ?? caller.ExplicitTenantId,
                    caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }

    private static async Task<IResult> GetTenantSettingsAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .AskAsync<GetResolvedSettingsQuery, GetResolvedSettingsResponse>(
                new GetResolvedSettingsQuery(userId, tenantId, caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }

    private static async Task<IResult> UpsertUiPreferencesAsync(
        UpsertUserUiPreferencesRequest body,
        ICallerContext caller,
        ITenantContext tenant,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .SendAsync<UpsertUserUiPreferencesCommand, UpsertUserUiPreferencesResponse>(
                body.ToCommand(
                    userId,
                    tenant.CurrentTenantId ?? caller.ExplicitTenantId,
                    caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }

    private static readonly JsonSerializerOptions EmailJsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static async Task<IResult> GetEmailSettingsAsync(
        SmtpEmailSender smtpSender,
        CancellationToken ct)
    {
        var config = await smtpSender.GetEffectiveConfigAsync(ct).ConfigureAwait(false);
        if (config is null)
        {
            return Results.Ok(new EmailSettingsResponse(
                IsEnabled: true,
                Host: "smtp.zoho.com",
                Port: 465,
                UseSsl: true,
                UserName: string.Empty,
                SenderEmail: string.Empty,
                SenderName: "EcuNexo",
                HasPassword: false));
        }

        return Results.Ok(new EmailSettingsResponse(
            IsEnabled: config.IsEnabled,
            Host: config.Host,
            Port: config.Port,
            UseSsl: config.UseSsl,
            UserName: config.UserName,
            SenderEmail: config.SenderEmail,
            SenderName: config.SenderName,
            HasPassword: !string.IsNullOrWhiteSpace(config.Password)));
    }

    private static async Task<IResult> UpdateEmailSettingsAsync(
        UpdateEmailSettingsRequest request,
        ISysSettingRepository repository,
        IIdGenerator idGen,
        IUnitOfWork uow,
        ICallerContext caller,
        CancellationToken ct)
    {
        var existing = await repository
            .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Global, null, ct)
            .ConfigureAwait(false);

        string passwordToSave = request.Password?.Trim() ?? string.Empty;

        if (existing is not null)
        {
            if (string.IsNullOrWhiteSpace(passwordToSave) || passwordToSave.All(c => c == '*'))
            {
                try
                {
                    var prev = JsonSerializer.Deserialize<EmailSmtpConfig>(existing.ValueJson, EmailJsonOpts);
                    if (prev is not null && !string.IsNullOrWhiteSpace(prev.Password))
                    {
                        passwordToSave = prev.Password;
                    }
                }
                catch
                {
                    /* si falla deserialize, se conserva passwordToSave */
                }
            }
        }

        var newConfig = new EmailSmtpConfig
        {
            IsEnabled = request.IsEnabled,
            Host = string.IsNullOrWhiteSpace(request.Host) ? "smtp.zoho.com" : request.Host.Trim(),
            Port = request.Port > 0 ? request.Port : 465,
            UseSsl = request.UseSsl,
            UserName = request.UserName?.Trim() ?? string.Empty,
            Password = passwordToSave,
            SenderEmail = request.SenderEmail?.Trim() ?? string.Empty,
            SenderName = string.IsNullOrWhiteSpace(request.SenderName) ? "EcuNexo" : request.SenderName.Trim(),
        };

        var json = JsonSerializer.Serialize(newConfig, EmailJsonOpts);

        if (existing is null)
        {
            var created = SysSetting.Create(
                idGen.NewId(),
                EmailSettingCodes.SmtpConfig,
                json,
                SettingScope.Global,
                null);

            if (created.IsFailure)
            {
                return Results.BadRequest(new { error = created.Error?.Message });
            }

            await repository.AddAsync(created.Value!, ct).ConfigureAwait(false);
        }
        else
        {
            var updateResult = existing.SetValue(json, caller.UserId);
            if (updateResult.IsFailure)
            {
                return Results.BadRequest(new { error = updateResult.Error?.Message });
            }
        }

        await uow.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Ok(new EmailSettingsResponse(
            newConfig.IsEnabled,
            newConfig.Host,
            newConfig.Port,
            newConfig.UseSsl,
            newConfig.UserName,
            newConfig.SenderEmail,
            newConfig.SenderName,
            !string.IsNullOrWhiteSpace(newConfig.Password)));
    }

    private static async Task<IResult> TestEmailSettingsAsync(
        TestEmailSettingsRequest request,
        SmtpEmailSender smtpSender,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.TargetEmail))
        {
            return Results.BadRequest(new TestEmailSettingsResponse(false, "El correo destinatario es obligatorio para la prueba."));
        }

        var savedConfig = await smtpSender.GetEffectiveConfigAsync(ct).ConfigureAwait(false);

        var host = !string.IsNullOrWhiteSpace(request.Host) ? request.Host.Trim() : savedConfig?.Host ?? "smtp.zoho.com";
        var port = (request.Port.HasValue && request.Port.Value > 0) ? request.Port.Value : savedConfig?.Port ?? 465;
        var useSsl = request.UseSsl ?? savedConfig?.UseSsl ?? true;
        var userName = !string.IsNullOrWhiteSpace(request.UserName) ? request.UserName.Trim() : savedConfig?.UserName ?? string.Empty;
        var password = (!string.IsNullOrWhiteSpace(request.Password) && !request.Password.All(c => c == '*'))
            ? request.Password.Trim()
            : savedConfig?.Password ?? string.Empty;
        var senderEmail = !string.IsNullOrWhiteSpace(request.SenderEmail) ? request.SenderEmail.Trim() : savedConfig?.SenderEmail ?? userName;
        var senderName = !string.IsNullOrWhiteSpace(request.SenderName) ? request.SenderName.Trim() : savedConfig?.SenderName ?? "EcuNexo";

        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            return Results.Ok(new TestEmailSettingsResponse(
                false,
                "Se requieren las credenciales SMTP (usuario y contraseña) para enviar el correo de prueba. Ingrésalas o guárdalas primero."));
        }

        var testConfig = new EmailSmtpConfig
        {
            IsEnabled = true,
            Host = host,
            Port = port,
            UseSsl = useSsl,
            UserName = userName,
            Password = password,
            SenderEmail = senderEmail,
            SenderName = senderName,
        };

        try
        {
            var subject = "Prueba de configuración de correo — EcuNexo";
            var textBody = $"¡Hola!\n\nSi estás leyendo este mensaje, la configuración del motor de correo electrónico (Zoho Mail / SMTP) en EcuNexo está funcionando correctamente para todas las empresas del sistema.\n\nFecha y hora: {DateTimeOffset.UtcNow:u}\nServidor: {testConfig.Host}:{testConfig.Port}\nRemitente: {testConfig.SenderName} <{testConfig.SenderEmail}>";
            var htmlBody = $@"
<div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;"">
    <h2 style=""color: #0284c7; margin-top: 0;"">EcuNexo — Verificación de Correo</h2>
    <p style=""font-size: 15px; line-height: 1.6; color: #334155;"">
        ¡Hola! La conexión al motor de correo SMTP ha sido verificada exitosamente.
    </p>
    <div style=""background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0;"">
        <p style=""margin: 4px 0; font-size: 13px; color: #475569;""><strong>Servidor:</strong> {testConfig.Host}:{testConfig.Port}</p>
        <p style=""margin: 4px 0; font-size: 13px; color: #475569;""><strong>Remitente:</strong> {testConfig.SenderName} &lt;{testConfig.SenderEmail}&gt;</p>
        <p style=""margin: 4px 0; font-size: 13px; color: #475569;""><strong>Fecha UTC:</strong> {DateTimeOffset.UtcNow:u}</p>
    </div>
    <p style=""font-size: 13px; color: #64748b;"">
        Este es un mensaje automático de comprobación del sistema EcuNexo.
    </p>
</div>";

            await SmtpEmailSender.SendMimeMessageAsync(
                testConfig,
                request.TargetEmail.Trim(),
                request.TargetEmail.Trim(),
                subject,
                textBody,
                htmlBody,
                ct).ConfigureAwait(false);

            return Results.Ok(new TestEmailSettingsResponse(
                true,
                $"¡Conexión SMTP exitosa! Se ha enviado un correo de prueba a {request.TargetEmail.Trim()}."));
        }
        catch (Exception ex)
        {
            return Results.Ok(new TestEmailSettingsResponse(
                false,
                $"Error de conexión SMTP con {testConfig.Host}:{testConfig.Port} — {ex.Message}"));
        }
    }
}
