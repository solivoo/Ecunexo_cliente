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
        email.MapDelete("", ResetEmailSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));
        email.MapPost("/test", TestEmailSettingsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));

        email.MapGet("/templates", GetEmailTemplatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.read", "tenancy.tenant.read"));
        email.MapPut("/templates/{actionCode}", UpdateEmailTemplateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));
        email.MapDelete("/templates/{actionCode}", ResetEmailTemplateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.update", "tenancy.tenant.update", "tenancy.tenant.read"));
        email.MapPost("/templates/preview", PreviewEmailTemplateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("platform.settings.read", "tenancy.tenant.read"));

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
        ISysSettingRepository repository,
        ITenantContext tenant,
        ICallerContext caller,
        CancellationToken ct)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        if (tenantId is { } tid && tid != Guid.Empty)
        {
            // 1. Ver si la empresa activa tiene configurado su propio motor de correo
            var tenantSetting = await repository
                .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Tenant, tid.ToString("D"), ct)
                .ConfigureAwait(false);

            if (tenantSetting is not null && !string.IsNullOrWhiteSpace(tenantSetting.ValueJson))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<EmailSmtpConfig>(tenantSetting.ValueJson, EmailJsonOpts);
                    if (parsed is not null)
                    {
                        return Results.Ok(new EmailSettingsResponse(
                            IsEnabled: parsed.IsEnabled,
                            Host: parsed.Host,
                            Port: parsed.Port,
                            UseSsl: parsed.UseSsl,
                            EncryptionMode: parsed.EncryptionMode.ToString(),
                            UserName: parsed.UserName,
                            SenderEmail: parsed.SenderEmail,
                            SenderName: parsed.SenderName,
                            HasPassword: !string.IsNullOrWhiteSpace(parsed.Password),
                            IsCustom: true,
                            Scope: "Tenant"));
                    }
                }
                catch
                {
                    /* si falla deserialize, caer al fallback */
                }
            }

            // 2. Si no tiene propio, devuelve el motor universal de EcuNexo como base heredada
            var fallback = await smtpSender.GetEffectiveConfigAsync(ct, null).ConfigureAwait(false);
            return Results.Ok(new EmailSettingsResponse(
                IsEnabled: fallback?.IsEnabled ?? true,
                Host: fallback?.Host ?? "smtp.zoho.com",
                Port: fallback?.Port ?? 465,
                UseSsl: fallback?.UseSsl ?? true,
                EncryptionMode: (fallback?.EncryptionMode ?? SmtpEncryptionMode.Auto).ToString(),
                UserName: fallback?.UserName ?? string.Empty,
                SenderEmail: fallback?.SenderEmail ?? string.Empty,
                SenderName: fallback?.SenderName ?? "EcuNexo",
                HasPassword: !string.IsNullOrWhiteSpace(fallback?.Password),
                IsCustom: false,
                Scope: "Global"));
        }

        // Modo sin tenant (titular global de plataforma)
        var globalConfig = await smtpSender.GetEffectiveConfigAsync(ct, null).ConfigureAwait(false);
        return Results.Ok(new EmailSettingsResponse(
            IsEnabled: globalConfig?.IsEnabled ?? true,
            Host: globalConfig?.Host ?? "smtp.zoho.com",
            Port: globalConfig?.Port ?? 465,
            UseSsl: globalConfig?.UseSsl ?? true,
            EncryptionMode: (globalConfig?.EncryptionMode ?? SmtpEncryptionMode.Auto).ToString(),
            UserName: globalConfig?.UserName ?? string.Empty,
            SenderEmail: globalConfig?.SenderEmail ?? string.Empty,
            SenderName: globalConfig?.SenderName ?? "EcuNexo",
            HasPassword: !string.IsNullOrWhiteSpace(globalConfig?.Password),
            IsCustom: false,
            Scope: "Global"));
    }

    private static async Task<IResult> UpdateEmailSettingsAsync(
        UpdateEmailSettingsRequest request,
        ISysSettingRepository repository,
        IIdGenerator idGen,
        IUnitOfWork uow,
        ITenantContext tenant,
        ICallerContext caller,
        SmtpEmailSender smtpSender,
        CancellationToken ct)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        var scope = (tenantId is { } tid && tid != Guid.Empty) ? SettingScope.Tenant : SettingScope.Global;
        var scopeId = scope == SettingScope.Tenant ? tenantId!.Value.ToString("D") : null;

        var existing = await repository
            .GetAsync(EmailSettingCodes.SmtpConfig, scope, scopeId, ct)
            .ConfigureAwait(false);

        string passwordToSave = request.Password?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(passwordToSave) || passwordToSave.All(c => c == '*'))
        {
            if (existing is not null)
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
            else if (scope == SettingScope.Tenant)
            {
                var fallbackConfig = await smtpSender.GetEffectiveConfigAsync(ct, null).ConfigureAwait(false);
                if (fallbackConfig is not null && !string.IsNullOrWhiteSpace(fallbackConfig.Password))
                {
                    passwordToSave = fallbackConfig.Password;
                }
            }
        }

        var encMode = Enum.TryParse<SmtpEncryptionMode>(request.EncryptionMode, true, out var parsedMode)
            ? parsedMode
            : SmtpEncryptionMode.Auto;

        var newConfig = new EmailSmtpConfig
        {
            IsEnabled = request.IsEnabled,
            Host = string.IsNullOrWhiteSpace(request.Host) ? "smtp.zoho.com" : request.Host.Trim(),
            Port = request.Port > 0 ? request.Port : 465,
            UseSsl = request.UseSsl,
            EncryptionMode = encMode,
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
                scope,
                scopeId);

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
            IsEnabled: newConfig.IsEnabled,
            Host: newConfig.Host,
            Port: newConfig.Port,
            UseSsl: newConfig.UseSsl,
            EncryptionMode: newConfig.EncryptionMode.ToString(),
            UserName: newConfig.UserName,
            SenderEmail: newConfig.SenderEmail,
            SenderName: newConfig.SenderName,
            HasPassword: !string.IsNullOrWhiteSpace(newConfig.Password),
            IsCustom: scope == SettingScope.Tenant,
            Scope: scope.ToString()));
    }

    private static async Task<IResult> ResetEmailSettingsAsync(
        ISysSettingRepository repository,
        IUnitOfWork uow,
        ITenantContext tenant,
        ICallerContext caller,
        SmtpEmailSender smtpSender,
        CancellationToken ct)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        if (tenantId is not { } tid || tid == Guid.Empty)
        {
            return Results.BadRequest(new { error = "Solo se puede restablecer la configuración de correo dentro del contexto de una empresa." });
        }

        var existing = await repository
            .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Tenant, tid.ToString("D"), ct)
            .ConfigureAwait(false);

        if (existing is not null)
        {
            repository.Remove(existing);
            await uow.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        var fallback = await smtpSender.GetEffectiveConfigAsync(ct, null).ConfigureAwait(false);
        return Results.Ok(new EmailSettingsResponse(
            IsEnabled: fallback?.IsEnabled ?? true,
            Host: fallback?.Host ?? "smtp.zoho.com",
            Port: fallback?.Port ?? 465,
            UseSsl: fallback?.UseSsl ?? true,
            EncryptionMode: (fallback?.EncryptionMode ?? SmtpEncryptionMode.Auto).ToString(),
            UserName: fallback?.UserName ?? string.Empty,
            SenderEmail: fallback?.SenderEmail ?? string.Empty,
            SenderName: fallback?.SenderName ?? "EcuNexo",
            HasPassword: !string.IsNullOrWhiteSpace(fallback?.Password),
            IsCustom: false,
            Scope: "Global"));
    }

    private static async Task<IResult> TestEmailSettingsAsync(
        TestEmailSettingsRequest request,
        SmtpEmailSender smtpSender,
        ISysSettingRepository repository,
        ITenantContext tenant,
        ICallerContext caller,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.TargetEmail))
        {
            return Results.BadRequest(new TestEmailSettingsResponse(false, "El correo destinatario es obligatorio para la prueba."));
        }

        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;

        // 1. Leer directamente el setting persistido del tenant para obtener las credenciales reales
        //    independientemente de si el motor está habilitado o no (la prueba siempre debe poder ejecutarse
        //    con las credenciales guardadas aunque el motor esté deshabilitado).
        EmailSmtpConfig? persistedTenantConfig = null;
        if (tenantId is { } effectiveTid && effectiveTid != Guid.Empty)
        {
            var tenantRaw = await repository
                .GetAsync(EmailSettingCodes.SmtpConfig, SettingScope.Tenant, effectiveTid.ToString("D"), ct)
                .ConfigureAwait(false);

            if (tenantRaw is not null && !string.IsNullOrWhiteSpace(tenantRaw.ValueJson))
            {
                try
                {
                    persistedTenantConfig = JsonSerializer.Deserialize<EmailSmtpConfig>(tenantRaw.ValueJson, EmailJsonOpts);
                }
                catch
                {
                    /* si el JSON está corrupto, continuar al fallback */
                }
            }
        }

        // 2. Si no hay config persistida del tenant, usar el motor efectivo (global/env).
        var savedConfig = persistedTenantConfig ?? await smtpSender.GetEffectiveConfigAsync(ct, tenantId).ConfigureAwait(false);

        var host = !string.IsNullOrWhiteSpace(request.Host) ? request.Host.Trim() : (savedConfig?.Host ?? "smtp.zoho.com");
        var port = (request.Port.HasValue && request.Port.Value > 0) ? request.Port.Value : (savedConfig?.Port ?? 465);
        var useSsl = request.UseSsl ?? (savedConfig?.UseSsl ?? true);
        var userName = !string.IsNullOrWhiteSpace(request.UserName) ? request.UserName.Trim() : (savedConfig?.UserName ?? string.Empty);
        var password = (!string.IsNullOrWhiteSpace(request.Password) && !request.Password.All(c => c == '*'))
            ? request.Password.Trim()
            : (savedConfig?.Password ?? string.Empty);
        var senderEmail = !string.IsNullOrWhiteSpace(request.SenderEmail) ? request.SenderEmail.Trim() : (savedConfig?.SenderEmail ?? userName);
        var senderName = !string.IsNullOrWhiteSpace(request.SenderName) ? request.SenderName.Trim() : (savedConfig?.SenderName ?? "EcuNexo");

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            return Results.Ok(new TestEmailSettingsResponse(
                false,
                "Se requieren las credenciales SMTP (servidor, usuario y contraseña) para enviar el correo de prueba. Ingrésalas en el formulario o guárdalas primero."));
        }

        Console.WriteLine($"[SMTP TEST] Diagnóstico de credenciales: Host={host}:{port}, User={userName}, PasswordLength={password.Length}");

        var testEncMode = !string.IsNullOrWhiteSpace(request.EncryptionMode) && Enum.TryParse<SmtpEncryptionMode>(request.EncryptionMode, true, out var parsedTestMode)
            ? parsedTestMode
            : (savedConfig?.EncryptionMode ?? SmtpEncryptionMode.Auto);

        var testConfig = new EmailSmtpConfig
        {
            IsEnabled = true,
            Host = host,
            Port = port,
            UseSsl = useSsl,
            EncryptionMode = testEncMode,
            UserName = userName,
            Password = password,
            SenderEmail = senderEmail,
            SenderName = senderName,
        };

        try
        {
            var subject = $"Prueba de configuración de correo — {testConfig.SenderName}";
            var textBody = $"¡Hola!\n\nSi estás leyendo este mensaje, la configuración del motor de correo electrónico (Zoho Mail / SMTP) en EcuNexo está funcionando correctamente.\n\nFecha y hora: {DateTimeOffset.UtcNow:u}\nServidor: {testConfig.Host}:{testConfig.Port}\nRemitente: {testConfig.SenderName} <{testConfig.SenderEmail}>";
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
                ct,
                logProtocol: true).ConfigureAwait(false);

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

    private static async Task<IResult> GetEmailTemplatesAsync(
        ISysSettingRepository repository,
        ITenantContext tenant,
        ICallerContext caller,
        CancellationToken ct)
    {
        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        var list = new List<EmailTemplateDto>();

        foreach (var sysDef in EmailTemplateCatalog.DefaultTemplates)
        {
            var code = EmailTemplateCatalog.GetSettingCode(sysDef.ActionCode);
            var isCustom = false;
            var subject = sysDef.DefaultSubject;
            var body = sysDef.DefaultBodyHtml;

            if (tenantId is { } tid && tid != Guid.Empty)
            {
                var setting = await repository.GetAsync(code, SettingScope.Tenant, tid.ToString("D"), ct).ConfigureAwait(false);
                if (setting is not null && !string.IsNullOrWhiteSpace(setting.ValueJson))
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(setting.ValueJson);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("subject", out var sProp) && !string.IsNullOrWhiteSpace(sProp.GetString()))
                        {
                            subject = sProp.GetString()!;
                        }
                        if (root.TryGetProperty("bodyHtml", out var bProp) && !string.IsNullOrWhiteSpace(bProp.GetString()))
                        {
                            body = bProp.GetString()!;
                        }
                        isCustom = true;
                    }
                    catch { }
                }
            }

            list.Add(new EmailTemplateDto(
                sysDef.ActionCode,
                sysDef.ActionName,
                sysDef.Description,
                subject,
                body,
                isCustom,
                sysDef.AvailablePlaceholders));
        }

        return Results.Ok(list);
    }

    private static async Task<IResult> UpdateEmailTemplateAsync(
        string actionCode,
        UpdateEmailTemplateRequest request,
        ISysSettingRepository repository,
        ITenantContext tenant,
        ICallerContext caller,
        IIdGenerator idGen,
        IUnitOfWork uow,
        CancellationToken ct)
    {
        var sysDef = EmailTemplateCatalog.GetByCode(actionCode);
        if (sysDef is null)
        {
            return Results.NotFound(new { error = $"Código de acción de correo '{actionCode}' no reconocido." });
        }

        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        var scope = (tenantId is { } tid && tid != Guid.Empty) ? SettingScope.Tenant : SettingScope.Global;
        var scopeId = scope == SettingScope.Tenant ? tenantId?.ToString("D") : null;

        var code = EmailTemplateCatalog.GetSettingCode(sysDef.ActionCode);
        var existing = await repository.GetAsync(code, scope, scopeId, ct).ConfigureAwait(false);

        var payload = JsonSerializer.Serialize(new
        {
            subject = request.SubjectTemplate?.Trim() ?? sysDef.DefaultSubject,
            bodyHtml = request.BodyHtmlTemplate?.Trim() ?? sysDef.DefaultBodyHtml,
        }, EmailJsonOpts);

        if (existing is null)
        {
            var created = SysSetting.Create(idGen.NewId(), code, payload, scope, scopeId);
            if (created.IsFailure)
            {
                return Results.BadRequest(new { error = created.Error?.Message });
            }
            await repository.AddAsync(created.Value!, ct).ConfigureAwait(false);
        }
        else
        {
            var updateRes = existing.SetValue(payload, caller.UserId);
            if (updateRes.IsFailure)
            {
                return Results.BadRequest(new { error = updateRes.Error?.Message });
            }
        }

        await uow.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Ok(new EmailTemplateDto(
            sysDef.ActionCode,
            sysDef.ActionName,
            sysDef.Description,
            request.SubjectTemplate?.Trim() ?? sysDef.DefaultSubject,
            request.BodyHtmlTemplate?.Trim() ?? sysDef.DefaultBodyHtml,
            true,
            sysDef.AvailablePlaceholders));
    }

    private static async Task<IResult> ResetEmailTemplateAsync(
        string actionCode,
        ISysSettingRepository repository,
        ITenantContext tenant,
        ICallerContext caller,
        IUnitOfWork uow,
        CancellationToken ct)
    {
        var sysDef = EmailTemplateCatalog.GetByCode(actionCode);
        if (sysDef is null)
        {
            return Results.NotFound(new { error = $"Código de acción '{actionCode}' no reconocido." });
        }

        var tenantId = tenant.CurrentTenantId ?? caller.ExplicitTenantId;
        if (tenantId is { } tid && tid != Guid.Empty)
        {
            var code = EmailTemplateCatalog.GetSettingCode(sysDef.ActionCode);
            var existing = await repository.GetAsync(code, SettingScope.Tenant, tid.ToString("D"), ct).ConfigureAwait(false);
            if (existing is not null)
            {
                repository.Remove(existing);
                await uow.SaveChangesAsync(ct).ConfigureAwait(false);
            }
        }

        return Results.Ok(new EmailTemplateDto(
            sysDef.ActionCode,
            sysDef.ActionName,
            sysDef.Description,
            sysDef.DefaultSubject,
            sysDef.DefaultBodyHtml,
            false,
            sysDef.AvailablePlaceholders));
    }

    private static IResult PreviewEmailTemplateAsync(PreviewEmailTemplateRequest request)
    {
        var sysDef = EmailTemplateCatalog.GetByCode(request.ActionCode);
        var subjectTpl = !string.IsNullOrWhiteSpace(request.SubjectTemplate) ? request.SubjectTemplate : (sysDef?.DefaultSubject ?? string.Empty);
        var bodyTpl = !string.IsNullOrWhiteSpace(request.BodyHtmlTemplate) ? request.BodyHtmlTemplate : (sysDef?.DefaultBodyHtml ?? string.Empty);

        var (renderedSub, renderedHtml) = EmailTemplateRenderer.Render(request.ActionCode, subjectTpl, bodyTpl);
        return Results.Ok(new PreviewEmailTemplateResponse(renderedSub, renderedHtml));
    }
}
