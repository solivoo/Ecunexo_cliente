using System.Net;
using EcuNexo.Api.Configuration;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;
using Microsoft.Extensions.Options;

namespace EcuNexo.Api.Licensing;

public sealed class LicenseOnlineValidator : ILicenseOnlineValidator
{
    private readonly HttpClient _http;
    private readonly LicenseValidationOptions _options;

    public LicenseOnlineValidator(HttpClient http, IOptions<LicenseValidationOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.PlatformApiBaseUrl);

    public async Task<Result<LicenseRemoteStatus>> ValidateGrantAsync(Guid grantId, CancellationToken ct)
    {
        if (!IsConfigured)
        {
            return Result.Failure<LicenseRemoteStatus>(
                new Error("license.online.not_configured", "Validación online no configurada.", ErrorType.Unexpected));
        }

        var baseUrl = _options.PlatformApiBaseUrl!.TrimEnd('/');
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

            return Result.Success(new LicenseRemoteStatus(body.GrantId, body.IsAllowed, body.Status, body.ExpiresAtUtc));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return Result.Failure<LicenseRemoteStatus>(
                new Error("license.online.network", "No hay conexión con el servicio de licencias.", ErrorType.Unexpected));
        }
    }

    private sealed record RemoteStatusDto(
        Guid GrantId,
        Guid? SupersedesGrantId,
        string Status,
        DateTimeOffset ExpiresAtUtc,
        bool IsAllowed,
        DateTimeOffset? RevokedAtUtc);
}
