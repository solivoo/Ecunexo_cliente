using System.Net;
using EcuNexo.Api.Configuration;
using EcuNexo.Api.Licensing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Tenancy;

public sealed class LicenseOnlineValidatorTests
{
    private readonly IHostEnvironment _env = Substitute.For<IHostEnvironment>();

    [Fact(DisplayName = "IsConfigured es falso si PlatformApiBaseUrl está vacío")]
    public void IsConfigured_ReturnsFalse_WhenUrlIsEmpty()
    {
        _env.EnvironmentName.Returns(Environments.Production);
        var validator = CreateValidator(new LicenseValidationOptions
        {
            PlatformApiBaseUrl = "",
            BypassInDevelopment = false,
        });

        validator.IsConfigured.Should().BeFalse();
    }

    [Fact(DisplayName = "IsConfigured es falso en Development cuando BypassInDevelopment es true")]
    public void IsConfigured_ReturnsFalse_InDevelopment_WhenBypassIsTrue()
    {
        _env.EnvironmentName.Returns(Environments.Development);
        var validator = CreateValidator(new LicenseValidationOptions
        {
            PlatformApiBaseUrl = "http://localhost:5090",
            BypassInDevelopment = true,
        });

        validator.IsConfigured.Should().BeFalse();
    }

    [Fact(DisplayName = "IsConfigured es verdadero en Development cuando BypassInDevelopment es false")]
    public void IsConfigured_ReturnsTrue_InDevelopment_WhenBypassIsFalse()
    {
        _env.EnvironmentName.Returns(Environments.Development);
        var validator = CreateValidator(new LicenseValidationOptions
        {
            PlatformApiBaseUrl = "http://localhost:5090",
            BypassInDevelopment = false,
        });

        validator.IsConfigured.Should().BeTrue();
    }

    [Fact(DisplayName = "IsConfigured es verdadero en Production aunque BypassInDevelopment sea true")]
    public void IsConfigured_ReturnsTrue_InProduction_EvenWhenBypassIsTrue()
    {
        _env.EnvironmentName.Returns(Environments.Production);
        var validator = CreateValidator(new LicenseValidationOptions
        {
            PlatformApiBaseUrl = "https://platform.ecunexo.com",
            BypassInDevelopment = true,
        });

        validator.IsConfigured.Should().BeTrue();
    }

    [Fact(DisplayName = "ValidateGrantAsync en Development con bypass activo retorna éxito sin llamar a la red")]
    public async Task ValidateGrantAsync_InDevelopment_BypassActive_ReturnsSuccess()
    {
        _env.EnvironmentName.Returns(Environments.Development);
        var validator = CreateValidator(new LicenseValidationOptions
        {
            PlatformApiBaseUrl = "http://localhost:5090",
            BypassInDevelopment = true,
        });

        var grantId = Guid.NewGuid();
        var result = await validator.ValidateGrantAsync(grantId, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.GrantId.Should().Be(grantId);
        result.Value.IsAllowed.Should().BeTrue();
        result.Value.Status.Should().Be("Active");
    }

    [Fact(DisplayName = "ValidateGrantAsync en Development sin bypass ante fallo de red retorna éxito con fallback")]
    public async Task ValidateGrantAsync_InDevelopment_NetworkError_GracefulFallback()
    {
        _env.EnvironmentName.Returns(Environments.Development);
        var handler = new MockHttpMessageHandler(_ => throw new HttpRequestException("Connection refused"));
        var httpClient = new HttpClient(handler);

        var validator = new LicenseOnlineValidator(
            httpClient,
            Options.Create(new LicenseValidationOptions
            {
                PlatformApiBaseUrl = "http://localhost:5090",
                BypassInDevelopment = false,
            }),
            _env,
            NullLogger<LicenseOnlineValidator>.Instance);

        var grantId = Guid.NewGuid();
        var result = await validator.ValidateGrantAsync(grantId, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.IsAllowed.Should().BeTrue();
    }

    [Fact(DisplayName = "ValidateGrantAsync en Production ante fallo de red retorna error")]
    public async Task ValidateGrantAsync_InProduction_NetworkError_ReturnsFailure()
    {
        _env.EnvironmentName.Returns(Environments.Production);
        var handler = new MockHttpMessageHandler(_ => throw new HttpRequestException("Network down"));
        var httpClient = new HttpClient(handler);

        var validator = new LicenseOnlineValidator(
            httpClient,
            Options.Create(new LicenseValidationOptions
            {
                PlatformApiBaseUrl = "https://platform.ecunexo.com",
                BypassInDevelopment = false,
            }),
            _env,
            NullLogger<LicenseOnlineValidator>.Instance);

        var result = await validator.ValidateGrantAsync(Guid.NewGuid(), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("license.online.network");
    }

    private LicenseOnlineValidator CreateValidator(LicenseValidationOptions options)
    {
        var httpClient = new HttpClient(new MockHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));
        return new LicenseOnlineValidator(
            httpClient,
            Options.Create(options),
            _env,
            NullLogger<LicenseOnlineValidator>.Instance);
    }

    private sealed class MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(handler(request));
        }
    }
}
