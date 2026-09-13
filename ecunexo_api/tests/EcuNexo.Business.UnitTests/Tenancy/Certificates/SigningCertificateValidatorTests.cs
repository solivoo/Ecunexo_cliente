using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using EcuNexo.Business.Tenancy.Certificates;

namespace EcuNexo.Business.UnitTests.Tenancy.Certificates;

public sealed class SigningCertificateValidatorTests
{
    [Fact(DisplayName = "Validate con bytes vacíos devuelve error certificate.empty")]
    public void Validate_EmptyBytes_ReturnsFailure()
    {
        var validator = new SigningCertificateValidator();

        var result = validator.Validate([], "password");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("certificate.empty");
    }

    [Fact(DisplayName = "Validate con contraseña vacía devuelve error certificate.password_required")]
    public void Validate_EmptyPassword_ReturnsFailure()
    {
        var validator = new SigningCertificateValidator();

        var result = validator.Validate(new byte[] { 1, 2, 3 }, "");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("certificate.password_required");
    }

    [Fact(DisplayName = "Validate con datos corruptos devuelve error certificate.invalid_password_or_format")]
    public void Validate_CorruptedBytes_ReturnsFailure()
    {
        var validator = new SigningCertificateValidator();

        var result = validator.Validate(new byte[] { 0xDE, 0xAD, 0xBE, 0xEF }, "password");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("certificate.invalid_password_or_format");
    }

    [Fact(DisplayName = "Validate con certificado PKCS#12 válido extrae titular, RUC y clave privada")]
    public void Validate_ValidPkcs12_ReturnsSuccessAndMetadata()
    {
        const string password = "TestPassword123!";
        var p12Bytes = GenerateTestPkcs12(
            subject: "CN=MARIA LOPEZ, SERIALNUMBER=1790016919001, C=EC",
            password: password,
            daysValid: 180);

        var validator = new SigningCertificateValidator();

        var result = validator.Validate(p12Bytes, password);

        result.IsSuccess.Should().BeTrue();
        var info = result.Value!;
        info.Subject.Should().Contain("MARIA LOPEZ");
        info.SubjectTaxId.Should().Be("1790016919001");
        info.HasPrivateKey.Should().BeTrue();
        info.ValidTo.Should().BeAfter(DateTime.UtcNow.AddDays(150));
    }

    [Fact(DisplayName = "Validate con contraseña incorrecta falla con invalid_password_or_format")]
    public void Validate_WrongPassword_ReturnsFailure()
    {
        var p12Bytes = GenerateTestPkcs12(
            subject: "CN=JUAN PEREZ, C=EC",
            password: "CorrectPassword123!",
            daysValid: 30);

        var validator = new SigningCertificateValidator();

        var result = validator.Validate(p12Bytes, "IncorrectPassword!!!");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("certificate.invalid_password_or_format");
    }

    [Fact(DisplayName = "Validate con certificado expirado devuelve error certificate.expired")]
    public void Validate_ExpiredCertificate_ReturnsFailure()
    {
        const string password = "Password123!";
        var p12Bytes = GenerateTestPkcs12(
            subject: "CN=CERT EXPIRADO, C=EC",
            password: password,
            daysValid: -10);

        var validator = new SigningCertificateValidator();

        var result = validator.Validate(p12Bytes, password);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("certificate.expired");
    }

    private static byte[] GenerateTestPkcs12(string subject, string password, int daysValid)
    {
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest(subject, rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        var now = DateTimeOffset.UtcNow;
        DateTimeOffset notBefore;
        DateTimeOffset notAfter;

        if (daysValid < 0)
        {
            notBefore = now.AddDays(daysValid - 30);
            notAfter = now.AddDays(daysValid);
        }
        else
        {
            notBefore = now.AddDays(-1);
            notAfter = now.AddDays(daysValid);
        }

        using var cert = req.CreateSelfSigned(notBefore, notAfter);
        return cert.Export(X509ContentType.Pkcs12, password);
    }
}
