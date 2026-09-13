using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class TenantSigningCertificateTests
{
    [Fact(DisplayName = "Create valida campos obligatorios e inicializa aggregate")]
    public void Create_ValidatesRequiredFields_AndInitializesEntity()
    {
        var tenantId = Guid.NewGuid();
        var data = new byte[] { 1, 2, 3, 4, 5 };
        var pwd = new byte[] { 9, 8, 7 };
        var nonce = new byte[12];
        var tag = new byte[16];
        var validFrom = DateTime.UtcNow.AddDays(-10);
        var validTo = DateTime.UtcNow.AddDays(355);

        var cert = TenantSigningCertificate.Create(
            tenantId,
            data,
            pwd,
            nonce,
            tag,
            subject: "CN=JUAN PEREZ, SERIALNUMBER=1710034065",
            issuer: "CN=BANCO CENTRAL DEL ECUADOR",
            validFrom: validFrom,
            validTo: validTo,
            subjectTaxId: "1710034065",
            serialNumber: "ABC123456",
            originalFileName: "firma.p12");

        cert.Should().NotBeNull();
        cert.TenantId.Should().Be(tenantId);
        cert.EncryptedData.Should().Equal(data);
        cert.EncryptedPassword.Should().Equal(pwd);
        cert.Nonce.Length.Should().Be(12);
        cert.Tag.Length.Should().Be(16);
        cert.Subject.Should().Be("CN=JUAN PEREZ, SERIALNUMBER=1710034065");
        cert.Issuer.Should().Be("CN=BANCO CENTRAL DEL ECUADOR");
        cert.SubjectTaxId.Should().Be("1710034065");
        cert.OriginalFileName.Should().Be("firma.p12");
        cert.IsActive.Should().BeTrue();
        cert.IsExpired.Should().BeFalse();
        cert.DaysRemaining.Should().BeGreaterThan(300);
    }

    [Fact(DisplayName = "Create lanza ArgumentException si faltan parámetros")]
    public void Create_ThrowsArgumentException_WhenRequiredArgumentsMissing()
    {
        var tenantId = Guid.NewGuid();
        var data = new byte[] { 1, 2, 3 };
        var pwd = new byte[] { 4, 5 };
        var nonce = new byte[12];
        var tag = new byte[16];

        // Empty TenantId
        var actEmptyTenant = () => TenantSigningCertificate.Create(
            Guid.Empty, data, pwd, nonce, tag, "Subject", "Issuer", DateTime.UtcNow, DateTime.UtcNow.AddDays(1));
        actEmptyTenant.Should().Throw<ArgumentException>();

        // Invalid nonce size (must be 12)
        var actInvalidNonce = () => TenantSigningCertificate.Create(
            tenantId, data, pwd, new byte[8], tag, "Subject", "Issuer", DateTime.UtcNow, DateTime.UtcNow.AddDays(1));
        actInvalidNonce.Should().Throw<ArgumentException>();

        // Invalid tag size (must be 16)
        var actInvalidTag = () => TenantSigningCertificate.Create(
            tenantId, data, pwd, nonce, new byte[10], "Subject", "Issuer", DateTime.UtcNow, DateTime.UtcNow.AddDays(1));
        actInvalidTag.Should().Throw<ArgumentException>();

        // ValidTo <= ValidFrom
        var actInvalidDates = () => TenantSigningCertificate.Create(
            tenantId, data, pwd, nonce, tag, "Subject", "Issuer", DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(5));
        actInvalidDates.Should().Throw<ArgumentException>();
    }

    [Fact(DisplayName = "IsExpired devuelve true cuando fecha de vencimiento ya pasó")]
    public void IsExpired_ReturnsTrue_WhenValidToIsInThePast()
    {
        var tenantId = Guid.NewGuid();
        var cert = TenantSigningCertificate.Create(
            tenantId,
            new byte[] { 1 },
            new byte[] { 2 },
            new byte[12],
            new byte[16],
            "Subject",
            "Issuer",
            DateTime.UtcNow.AddYears(-2),
            DateTime.UtcNow.AddDays(-1));

        cert.IsExpired.Should().BeTrue();
        cert.DaysRemaining.Should().Be(0);
    }

    [Fact(DisplayName = "Update actualiza metadatos y Deactivate desactiva el certificado")]
    public void Update_And_Deactivate_WorkCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var cert = TenantSigningCertificate.Create(
            tenantId,
            new byte[] { 1 },
            new byte[] { 2 },
            new byte[12],
            new byte[16],
            "Subject Old",
            "Issuer Old",
            DateTime.UtcNow.AddDays(-10),
            DateTime.UtcNow.AddDays(100));

        cert.Deactivate();
        cert.IsActive.Should().BeFalse();

        cert.Update(
            new byte[] { 3, 4 },
            new byte[] { 5, 6 },
            new byte[12],
            new byte[16],
            "Subject New",
            "Issuer New",
            DateTime.UtcNow.AddDays(-5),
            DateTime.UtcNow.AddDays(200),
            subjectTaxId: "1790016919001",
            serialNumber: "SN9999",
            originalFileName: "nuevo.p12");

        cert.IsActive.Should().BeTrue();
        cert.Subject.Should().Be("Subject New");
        cert.Issuer.Should().Be("Issuer New");
        cert.SubjectTaxId.Should().Be("1790016919001");
        cert.OriginalFileName.Should().Be("nuevo.p12");
    }
}
