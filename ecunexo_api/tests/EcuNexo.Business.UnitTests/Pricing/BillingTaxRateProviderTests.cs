using System.Net;
using System.Text;
using EcuNexo.Business.Pricing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class BillingTaxRateProviderTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Obtiene la tarifa desde Facturación y la normaliza a fracción")]
    public async Task GetRateAsync_UsesBillingRateAndCaches()
    {
        var handler = new StubHttpMessageHandler(_ => Json(
            "[{\"taxCode\":\"2\",\"rateCode\":\"4\",\"description\":\"IVA 15%\",\"rate\":15,\"validFrom\":\"2024-04-01\",\"validTo\":null}]"));
        var provider = CreateProvider(handler, baseUrl: "http://billing.test");

        var first = await provider.GetRateAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), Today, CancellationToken.None);
        var second = await provider.GetRateAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), Today, CancellationToken.None);

        first.Should().Be(0.15m);
        second.Should().Be(0.15m);
        handler.Requests.Should().ContainSingle();
        handler.Requests[0].Should().Contain("taxCode=2").And.Contain("rateCode=4").And.Contain("date=2026-09-26");
    }

    [Fact(DisplayName = "Sin URL de Facturación usa la tarifa de respaldo sin llamadas HTTP")]
    public async Task GetRateAsync_WithoutBaseUrl_ReturnsFallback()
    {
        var handler = new StubHttpMessageHandler(_ => Json("[]"));
        var provider = CreateProvider(handler, baseUrl: "");

        var rate = await provider.GetRateAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), Today, CancellationToken.None);

        rate.Should().Be(0.15m);
        handler.Requests.Should().BeEmpty();
    }

    [Fact(DisplayName = "Si Facturación falla usa la tarifa de respaldo")]
    public async Task GetRateAsync_WhenBillingFails_ReturnsFallback()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var provider = CreateProvider(handler, baseUrl: "http://billing.test");

        var rate = await provider.GetRateAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), Today, CancellationToken.None);

        rate.Should().Be(0.15m);
    }

    [Fact(DisplayName = "Si el catálogo responde vacío usa la tarifa de respaldo")]
    public async Task GetRateAsync_EmptyCatalog_ReturnsFallback()
    {
        var handler = new StubHttpMessageHandler(_ => Json("[]"));
        var provider = CreateProvider(handler, baseUrl: "http://billing.test");

        var rate = await provider.GetRateAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), Today, CancellationToken.None);

        rate.Should().Be(0.15m);
    }

    private static BillingTaxRateProvider CreateProvider(StubHttpMessageHandler handler, string baseUrl)
    {
        var client = new HttpClient(handler);
        if (!string.IsNullOrWhiteSpace(baseUrl))
        {
            client.BaseAddress = new Uri(baseUrl);
        }

        var options = Options.Create(new BillingTaxRateOptions
        {
            BaseUrl = baseUrl,
            TaxCode = "2",
            DefaultRateCode = "4",
            FallbackRate = 0.15m,
        });

        return new BillingTaxRateProvider(
            client,
            new MemoryCache(new MemoryCacheOptions()),
            options,
            NullLogger<BillingTaxRateProvider>.Instance);
    }

    private static HttpResponseMessage Json(string payload) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        public List<string> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri?.ToString() ?? string.Empty);
            return Task.FromResult(_responder(request));
        }
    }
}
