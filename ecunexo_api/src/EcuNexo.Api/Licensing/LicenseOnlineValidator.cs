using System.Net;
using System.Text.Json;
using EcuNexo.Api.Configuration;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Licensing;

public sealed partial class LicenseOnlineValidator : ILicenseOnlineValidator
{
    private readonly HttpClient _http;
    private readonly LicenseValidationOptions _options;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<LicenseOnlineValidator> _logger;

    public LicenseOnlineValidator(
        HttpClient http,
        IOptions<LicenseValidationOptions> options,
        IHostEnvironment environment,
        ILogger<LicenseOnlineValidator> logger)
    {
        _http = http;
        _options = options.Value;
        _environment = environment;
        _logger = logger;
    }

    public bool IsConfigured => GetCandidateBaseUrls().Count > 0;

    private List<string> GetCandidateBaseUrls()
    {
        var candidateUrls = new List<string>();
        if (!string.IsNullOrWhiteSpace(_options.PlatformApiBaseUrl))
        {
            candidateUrls.Add(_options.PlatformApiBaseUrl.TrimEnd('/'));
        }

        foreach (var fallback in new[]
                 {
                     "http://host.docker.internal:5090",
                     "http://172.17.0.1:5090",
                     "http://localhost:5090",
                 })
        {
            if (!candidateUrls.Contains(fallback, StringComparer.OrdinalIgnoreCase))
            {
                candidateUrls.Add(fallback);
            }
        }

        return candidateUrls;
    }

    public async Task<Result<LicenseRemoteStatus>> ValidateGrantAsync(Guid grantId, CancellationToken ct)
    {
        var candidateUrls = GetCandidateBaseUrls();
        if (candidateUrls.Count == 0)
        {
            if (_environment.IsDevelopment() && _options.BypassInDevelopment)
            {
                LogBypassInDevelopment(_logger, grantId);

                return Result.Success(new LicenseRemoteStatus(
                    grantId,
                    IsAllowed: true,
                    Status: "Active",
                    ExpiresAtUtc: DateTimeOffset.UtcNow.AddYears(1)));
            }

            return Result.Failure<LicenseRemoteStatus>(
                new Error("license.online.not_configured", "Validación online no configurada.", ErrorType.Unexpected));
        }

        Exception? lastNetworkException = null;
        foreach (var baseUrl in candidateUrls)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/v1/platform/licenses/{grantId}/status");
            if (!string.IsNullOrWhiteSpace(_options.PlatformApiKey))
            {
                request.Headers.TryAddWithoutValidation("X-Platform-Validation-Key", _options.PlatformApiKey);
            }

            try
            {
                using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    return Result.Failure<LicenseRemoteStatus>(
                        new Error(
                            "license.online.not_found",
                            "La licencia no está registrada en Ecunexo.",
                            ErrorType.NotFound));
                }

                if (!response.IsSuccessStatusCode)
                {
                    return Result.Failure<LicenseRemoteStatus>(
                        new Error(
                            "license.online.unavailable",
                            "No se pudo consultar el estado de la licencia.",
                            ErrorType.Unexpected));
                }

                var body = await response.Content.ReadFromJsonAsync<RemoteStatusDto>(cancellationToken: ct).ConfigureAwait(false);
                if (body is null)
                {
                    return Result.Failure<LicenseRemoteStatus>(
                        new Error("license.online.invalid_response", "Respuesta de licencia inválida.", ErrorType.Unexpected));
                }

                return Result.Success(new LicenseRemoteStatus(
                    body.GrantId,
                    body.IsAllowed,
                    body.Status,
                    body.ExpiresAtUtc,
                    body.SuccessorGrantId,
                    body.SuccessorStatus,
                    body.SuccessorExpiresAtUtc,
                    body.SuccessorPlanCode,
                    body.SuccessorPlanLabel,
                    body.SuccessorMaxTenants,
                    body.SuccessorMaxUsers,
                    body.SuccessorMaxWarehouses,
                    body.SuccessorOnlineValidationIntervalDays,
                    body.SuccessorEnabledModuleCodes,
                    body.SuccessorModuleEntitlements));
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                lastNetworkException = ex;
            }
        }

        if (_environment.IsDevelopment() && lastNetworkException is not null)
        {
            LogDevNetworkFallback(_logger, _options.PlatformApiBaseUrl, lastNetworkException);

            return Result.Success(new LicenseRemoteStatus(
                grantId,
                IsAllowed: true,
                Status: "Active",
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddYears(1)));
        }

        return Result.Failure<LicenseRemoteStatus>(
            new Error("license.online.network", "No hay conexión con el servicio de licencias.", ErrorType.Unexpected));
    }

    private sealed record RemoteStatusDto(
        Guid GrantId,
        Guid? SupersedesGrantId,
        string Status,
        DateTimeOffset ExpiresAtUtc,
        bool IsAllowed,
        DateTimeOffset? RevokedAtUtc,
        Guid? SuccessorGrantId = null,
        string? SuccessorStatus = null,
        DateTimeOffset? SuccessorExpiresAtUtc = null,
        string? SuccessorPlanCode = null,
        string? SuccessorPlanLabel = null,
        int? SuccessorMaxTenants = null,
        int? SuccessorMaxUsers = null,
        int? SuccessorMaxWarehouses = null,
        int? SuccessorOnlineValidationIntervalDays = null,
        IReadOnlyList<string>? SuccessorEnabledModuleCodes = null,
        IReadOnlyList<ModuleEntitlement>? SuccessorModuleEntitlements = null);

    public async Task<Result<Unit>> ReportTenantsAsync(
        Guid grantId,
        IReadOnlyList<LicenseTenantRef> tenants,
        CancellationToken ct)
    {
        var candidateUrls = GetCandidateBaseUrls();
        if (candidateUrls.Count == 0 || tenants.Count == 0)
        {
            return Unit.Value;
        }

        foreach (var baseUrl in candidateUrls)
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/api/v1/platform/licenses/{grantId}/tenants")
            {
                Content = JsonContent.Create(new ReportTenantsDto(
                    tenants.Select(t => new ReportTenantDto(t.TenantId, t.Name)).ToList())),
            };
            if (!string.IsNullOrWhiteSpace(_options.PlatformApiKey))
            {
                request.Headers.TryAddWithoutValidation("X-Platform-Validation-Key", _options.PlatformApiKey);
            }

            try
            {
                using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                {
                    return Result.Failure<Unit>(
                        new Error(
                            "license.online.tenants_report",
                            "No se pudieron reportar las empresas a la plataforma de licencias.",
                            ErrorType.Unexpected));
                }

                return Unit.Value;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                // Intentar siguiente URL candidata
            }
        }

        return Result.Failure<Unit>(
            new Error("license.online.network", "No hay conexión con el servicio de licencias.", ErrorType.Unexpected));
    }

    private sealed record ReportTenantsDto(IReadOnlyList<ReportTenantDto> Tenants);

    private sealed record ReportTenantDto(Guid TenantId, string Name);

    public async Task<Result<LicenseRemoteEntitlements>> GetEntitlementsAsync(
        Guid grantId,
        CancellationToken ct)
    {
        var candidateUrls = GetCandidateBaseUrls();
        if (candidateUrls.Count == 0)
        {
            return Result.Failure<LicenseRemoteEntitlements>(
                new Error("license.online.not_configured", "Validación online no configurada.", ErrorType.Unexpected));
        }

        foreach (var baseUrl in candidateUrls)
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{baseUrl}/api/v1/platform/licenses/{grantId}/entitlements");
            if (!string.IsNullOrWhiteSpace(_options.PlatformApiKey))
            {
                request.Headers.TryAddWithoutValidation("X-Platform-Validation-Key", _options.PlatformApiKey);
            }

            try
            {
                using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
                if (response.StatusCode == HttpStatusCode.NotFound)
                {
                    return Result.Failure<LicenseRemoteEntitlements>(
                        new Error("license.online.not_found", "La licencia no está registrada en Ecunexo.", ErrorType.NotFound));
                }

                if (!response.IsSuccessStatusCode)
                {
                    return Result.Failure<LicenseRemoteEntitlements>(
                        new Error("license.online.unavailable", "No se pudieron consultar los módulos de la licencia.", ErrorType.Unexpected));
                }

                var body = await response.Content
                    .ReadFromJsonAsync<RemoteEntitlementsDto>(cancellationToken: ct)
                    .ConfigureAwait(false);
                if (body is null)
                {
                    return Result.Failure<LicenseRemoteEntitlements>(
                        new Error("license.online.invalid_response", "Respuesta de entitlements inválida.", ErrorType.Unexpected));
                }

                return Result.Success(new LicenseRemoteEntitlements(
                    body.GrantId,
                    body.EntitlementsVersion,
                    body.EnabledModuleCodes,
                    body.ModuleEntitlements,
                    body.UpdatedAtUtc,
                    body.TenantOverrides?
                        .Select(o => new LicenseRemoteTenantOverride(
                            o.TenantId,
                            o.TenantName,
                            o.EnabledModuleCodes,
                            o.ModuleEntitlements,
                            o.OverrideVersion))
                        .ToList()));
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                // Intentar siguiente URL candidata
            }
        }

        return Result.Failure<LicenseRemoteEntitlements>(
            new Error("license.online.network", "No hay conexión con el servicio de licencias.", ErrorType.Unexpected));
    }

    private sealed record RemoteEntitlementsDto(
        Guid GrantId,
        int EntitlementsVersion,
        IReadOnlyList<string> EnabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
        DateTimeOffset? UpdatedAtUtc,
        IReadOnlyList<RemoteTenantOverrideDto>? TenantOverrides);

    private sealed record RemoteTenantOverrideDto(
        Guid TenantId,
        string TenantName,
        IReadOnlyList<string> EnabledModuleCodes,
        IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
        int OverrideVersion);

    public async Task<Result<LicenseRemoteCloudBootstrap>> BootstrapCloudSubscriptionAsync(
        string email,
        string password,
        CancellationToken ct)
    {
        foreach (var baseUrl in GetCandidateBaseUrls())
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{baseUrl}/api/v1/platform/licenses/cloud-bootstrap")
            {
                Content = JsonContent.Create(new CloudBootstrapRequestDto(email, password)),
            };
            if (!string.IsNullOrWhiteSpace(_options.PlatformApiKey))
            {
                request.Headers.TryAddWithoutValidation("X-Platform-Validation-Key", _options.PlatformApiKey);
            }

            try
            {
                using var response = await _http.SendAsync(request, ct).ConfigureAwait(false);
                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    return Result.Failure<LicenseRemoteCloudBootstrap>(
                        new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
                }

                if (!response.IsSuccessStatusCode)
                {
                    continue;
                }

                var body = await response.Content
                    .ReadFromJsonAsync<LicenseRemoteCloudBootstrap>(cancellationToken: ct)
                    .ConfigureAwait(false);
                if (body is not null)
                {
                    return Result.Success(body);
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
            {
                // Intentar siguiente URL candidata
            }
        }

        return Result.Failure<LicenseRemoteCloudBootstrap>(
            new Error("auth.login.failed", "Credenciales inválidas.", ErrorType.Unauthorized));
    }

    private sealed record CloudBootstrapRequestDto(string Email, string Password);

    [LoggerMessage(
        EventId = 9501,
        Level = LogLevel.Information,
        Message = "Validación online de licencias omitida en ambiente Development (BypassInDevelopment=true, GrantId: {GrantId}).")]
    private static partial void LogBypassInDevelopment(ILogger logger, Guid grantId);

    [LoggerMessage(
        EventId = 9502,
        Level = LogLevel.Warning,
        Message = "Ambiente de desarrollo: no se pudo contactar al servicio de licencias en {Url}. Permitiendo ejecución local para no interrumpir el flujo de desarrollo.")]
    private static partial void LogDevNetworkFallback(ILogger logger, string? url, Exception exception);
}
