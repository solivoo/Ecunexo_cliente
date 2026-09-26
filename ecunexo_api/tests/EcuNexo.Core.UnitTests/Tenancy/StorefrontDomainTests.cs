using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class StorefrontDomainTests
{
    [Theory(DisplayName = "Normaliza el dominio a minúsculas, sin puerto ni punto final")]
    [InlineData("Tienda.Empresa.COM", "tienda.empresa.com")]
    [InlineData("tienda.empresa.com.", "tienda.empresa.com")]
    [InlineData("tienda.empresa.com:443", "tienda.empresa.com")]
    public void NormalizeDomain_NormalizaEntrada(string raw, string expected)
    {
        var result = StorefrontDomain.NormalizeDomain(raw);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(expected);
    }

    [Fact(DisplayName = "Convierte dominios internacionales a punycode")]
    public void NormalizeDomain_ConvierteIdnAPunycode()
    {
        var result = StorefrontDomain.NormalizeDomain("tienda.ñandú.com");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("tienda.xn--and-6ma2c.com");
    }

    [Theory(DisplayName = "Rechaza dominios inválidos")]
    [InlineData("localhost")]
    [InlineData("https://tienda.empresa.com")]
    [InlineData("tienda empresa.com")]
    [InlineData("192.168.1.10")]
    [InlineData("-tienda.empresa.com")]
    [InlineData("tienda..com")]
    [InlineData("tienda.empresa.com/path")]
    public void NormalizeDomain_RechazaInvalidos(string raw)
    {
        StorefrontDomain.NormalizeDomain(raw).IsFailure.Should().BeTrue();
    }

    [Fact(DisplayName = "Crea el dominio pendiente con token de verificación")]
    public void Create_GeneraTokenYPendiente()
    {
        var domain = StorefrontDomain.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "tienda.empresa.com").Value!;

        domain.IsVerified.Should().BeFalse();
        domain.IsPrimary.Should().BeFalse();
        domain.VerificationToken.Should().NotBeNullOrWhiteSpace();
        domain.TxtRecordName.Should().Be("_ecunexo.tienda.empresa.com");
        domain.TxtRecordValue.Should().Be(
            $"{StorefrontDomain.VerificationPrefix}{domain.VerificationToken}");
    }

    [Fact(DisplayName = "Marca el dominio como verificado")]
    public void MarkVerified_MarcaElDominio()
    {
        var now = DateTimeOffset.UtcNow;
        var domain = StorefrontDomain.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "tienda.empresa.com").Value!;

        domain.MarkVerified(now).IsSuccess.Should().BeTrue();

        domain.IsVerified.Should().BeTrue();
        domain.VerifiedAt.Should().Be(now);
    }
}
