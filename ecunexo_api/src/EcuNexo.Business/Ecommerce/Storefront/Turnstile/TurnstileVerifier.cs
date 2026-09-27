using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcuNexo.Business.Ecommerce.Storefront.Turnstile;

/// <summary>
/// Verifica tokens de Cloudflare Turnstile contra el endpoint server-side <c>siteverify</c>.
/// </summary>
public sealed class TurnstileVerifier : ITurnstileVerifier
{
    private static readonly Action<ILogger, Exception?> LogNetworkFailure =
        LoggerMessage.Define(
            LogLevel.Warning,
            new EventId(1, "TurnstileVerificationFailed"),
            "No se pudo verificar el token de Turnstile por un fallo de red o respuesta inválida.");

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly TurnstileOptions _options;
    private readonly ILogger<TurnstileVerifier> _logger;

    public TurnstileVerifier(
        HttpClient http,
        IOptions<TurnstileOptions> options,
        ILogger<TurnstileVerifier> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.IsEnabled;

    public async Task<TurnstileVerificationResult> VerifyAsync(
        string? token,
        string? remoteIp,
        CancellationToken ct)
    {
        if (!IsEnabled)
        {
            return TurnstileVerificationResult.Ok();
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return TurnstileVerificationResult.Failed("missing-input-response");
        }

        var fields = new List<KeyValuePair<string, string>>
        {
            new("secret", _options.SecretKey.Trim()),
            new("response", token.Trim()),
        };

        if (!string.IsNullOrWhiteSpace(remoteIp))
        {
            fields.Add(new KeyValuePair<string, string>("remoteip", remoteIp.Trim()));
        }

        var verifyUrl = string.IsNullOrWhiteSpace(_options.VerifyUrl)
            ? TurnstileOptions.DefaultVerifyUrl
            : _options.VerifyUrl.Trim();

        try
        {
            using var content = new FormUrlEncodedContent(fields);
            using var response = await _http
                .PostAsync(verifyUrl, content, ct)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                return TurnstileVerificationResult.Failed($"http-{(int)response.StatusCode}");
            }

            var payload = await response.Content
                .ReadFromJsonAsync<TurnstileResponse>(JsonOptions, ct)
                .ConfigureAwait(false);

            if (payload is null)
            {
                return TurnstileVerificationResult.Failed("invalid-response");
            }

            return payload.Success
                ? TurnstileVerificationResult.Ok()
                : TurnstileVerificationResult.Failed(payload.ErrorCodes?.ToArray() ?? []);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or NotSupportedException)
        {
            LogNetworkFailure(_logger, ex);
            return TurnstileVerificationResult.Failed("network-error");
        }
    }

    private sealed record TurnstileResponse(
        bool Success,
        [property: JsonPropertyName("error-codes")] IReadOnlyList<string>? ErrorCodes);
}
