using System.Net;
using System.Text;
using EcuNexo.Business.Ecommerce.Storefront.Turnstile;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class TurnstileVerifierTests
{
    [Fact(DisplayName = "Sin secret key el verificador queda deshabilitado y aprueba sin llamar a Cloudflare")]
    public async Task VerifyAsync_WithoutSecretKey_IsDisabledAndSucceeds()
    {
        var handler = new StubHandler(_ => Json(HttpStatusCode.OK, """{"success":true}"""));
        var verifier = CreateVerifier(handler, new TurnstileOptions { SiteKey = "site-key" });

        verifier.IsEnabled.Should().BeFalse();

        var result = await verifier.VerifyAsync("token", "127.0.0.1", CancellationToken.None);

        result.Success.Should().BeTrue();
        handler.LastRequest.Should().BeNull();
    }

    [Fact(DisplayName = "Con secret key envía secret, response y remoteip al endpoint siteverify")]
    public async Task VerifyAsync_Enabled_SendsFormAndParsesSuccess()
    {
        var handler = new StubHandler(_ => Json(HttpStatusCode.OK, """{"success":true,"error-codes":[]}"""));
        var verifier = CreateVerifier(handler, new TurnstileOptions
        {
            SiteKey = "site-key",
            SecretKey = "secret-key",
        });

        verifier.IsEnabled.Should().BeTrue();

        var result = await verifier.VerifyAsync("token-123", "10.0.0.5", CancellationToken.None);

        result.Success.Should().BeTrue();
        handler.LastRequest.Should().NotBeNull();
        handler.LastRequest!.Method.Should().Be(HttpMethod.Post);
        handler.LastRequest.RequestUri!.ToString().Should().Be(TurnstileOptions.DefaultVerifyUrl);
        handler.LastBody.Should().NotBeNull();
        handler.LastBody!.Should().Contain("secret=secret-key");
        handler.LastBody.Should().Contain("response=token-123");
        handler.LastBody.Should().Contain("remoteip=10.0.0.5");
    }

    [Fact(DisplayName = "Una respuesta con success=false devuelve los error-codes")]
    public async Task VerifyAsync_InvalidToken_ReturnsErrorCodes()
    {
        var handler = new StubHandler(_ => Json(
            HttpStatusCode.OK,
            """{"success":false,"error-codes":["invalid-input-response"]}"""));
        var verifier = CreateVerifier(handler, new TurnstileOptions { SecretKey = "secret-key" });

        var result = await verifier.VerifyAsync("bad", null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().ContainSingle().Which.Should().Be("invalid-input-response");
    }

    [Fact(DisplayName = "Un fallo de red se considera fracaso")]
    public async Task VerifyAsync_NetworkFailure_ReturnsFailure()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("sin red"));
        var verifier = CreateVerifier(handler, new TurnstileOptions { SecretKey = "secret-key" });

        var result = await verifier.VerifyAsync("token", null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("network-error");
    }

    [Fact(DisplayName = "Con Turnstile habilitado un token vacío fracasa sin llamar al endpoint")]
    public async Task VerifyAsync_EnabledWithoutToken_ReturnsFailure()
    {
        var handler = new StubHandler(_ => Json(HttpStatusCode.OK, """{"success":true}"""));
        var verifier = CreateVerifier(handler, new TurnstileOptions { SecretKey = "secret-key" });

        var result = await verifier.VerifyAsync("  ", null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.ErrorCodes.Should().Contain("missing-input-response");
        handler.LastRequest.Should().BeNull();
    }

    private static TurnstileVerifier CreateVerifier(HttpMessageHandler handler, TurnstileOptions options) =>
        new(
            new HttpClient(handler),
            Options.Create(options),
            NullLogger<TurnstileVerifier>.Instance);

    private static HttpResponseMessage Json(HttpStatusCode statusCode, string json) =>
        new(statusCode)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };

    private sealed class StubHandler(
        Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            LastRequest = request;
            LastBody = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            return responder(request);
        }
    }
}
