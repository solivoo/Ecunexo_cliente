using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EcuNexo.Business.Pricing;

/// <summary>
/// Resuelve la tarifa IVA vigente desde el catálogo de tarifas de Facturación, con caché por
/// fecha y tarifa de respaldo si el servicio no está disponible.
/// </summary>
public sealed class BillingTaxRateProvider : ITaxRateProvider
{
    private static readonly Action<ILogger, decimal, Exception?> LogFallback =
        LoggerMessage.Define<decimal>(
            LogLevel.Warning,
            new EventId(1, "BillingTaxRateFallback"),
            "No se pudo obtener la tarifa IVA desde Facturación; se usa la tarifa de respaldo {FallbackRate}.");

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly BillingTaxRateOptions _options;
    private readonly ILogger<BillingTaxRateProvider> _logger;

    public BillingTaxRateProvider(
        HttpClient http,
        IMemoryCache cache,
        IOptions<BillingTaxRateOptions> options,
        ILogger<BillingTaxRateProvider> logger)
    {
        _http = http;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<decimal> GetRateAsync(
        Guid tenantId,
        Guid catalogItemId,
        DateOnly date,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            return _options.FallbackRate;
        }

        var cacheKey = $"billing-tax-rate:{_options.TaxCode}:{_options.DefaultRateCode}:{date:yyyy-MM-dd}";
        if (_cache.TryGetValue(cacheKey, out decimal cached))
        {
            return cached;
        }

        try
        {
            var url = "api/v1/catalogs/tax-rates"
                + $"?taxCode={Uri.EscapeDataString(_options.TaxCode)}"
                + $"&rateCode={Uri.EscapeDataString(_options.DefaultRateCode)}"
                + $"&date={date:yyyy-MM-dd}";

            var rates = await _http
                .GetFromJsonAsync<List<BillingTaxRateDto>>(url, ct)
                .ConfigureAwait(false);

            var rate = rates?.FirstOrDefault()?.Rate;
            var normalized = rate.HasValue ? rate.Value / 100m : _options.FallbackRate;

            _cache.Set(cacheKey, normalized, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
            return normalized;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            LogFallback(_logger, _options.FallbackRate, ex);

            _cache.Set(cacheKey, _options.FallbackRate, TimeSpan.FromMinutes(5));
            return _options.FallbackRate;
        }
    }

    private sealed record BillingTaxRateDto(
        string TaxCode,
        string RateCode,
        string Description,
        decimal Rate,
        DateOnly ValidFrom,
        DateOnly? ValidTo);
}
