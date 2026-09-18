using System.Security.Cryptography;
using System.Text;
using EcuNexo.Business.Tenancy.Certificates;
using Microsoft.Extensions.Configuration;

namespace EcuNexo.Business.UnitTests.Tenancy.Certificates;

public sealed class AesGcmCertificateEncryptionServiceTests
{
    private static readonly byte[] TestKey = SHA256.HashData(Encoding.UTF8.GetBytes("test-secret-key-32-bytes-long!!"));

    [Fact(DisplayName = "Encrypt y Decrypt recuperan exactamente los bytes originales")]
    public void Encrypt_And_Decrypt_ReturnsOriginalBytes()
    {
        var service = new AesGcmCertificateEncryptionService(TestKey);
        var originalData = Encoding.UTF8.GetBytes("Contenido sensible de prueba: certificado .p12 con clave privada");

        var payload = service.Encrypt(originalData);

        payload.Should().NotBeNull();
        payload.Ciphertext.Should().NotEqual(originalData);
        payload.Nonce.Length.Should().Be(12);
        payload.Tag.Length.Should().Be(16);

        var decrypted = service.Decrypt(payload.Ciphertext, payload.Nonce, payload.Tag);
        decrypted.Should().Equal(originalData);
    }

    [Fact(DisplayName = "Decrypt con ciphertext corrupto lanza CryptographicException")]
    public void Decrypt_CorruptedCiphertext_ThrowsCryptographicException()
    {
        var service = new AesGcmCertificateEncryptionService(TestKey);
        var originalData = Encoding.UTF8.GetBytes("Datos protegidos");

        var payload = service.Encrypt(originalData);
        payload.Ciphertext[0] ^= 0xFF; // Corromper un bit

        var act = () => service.Decrypt(payload.Ciphertext, payload.Nonce, payload.Tag);
        act.Should().Throw<CryptographicException>();
    }

    [Fact(DisplayName = "Decrypt con tag alterado lanza CryptographicException")]
    public void Decrypt_TamperedTag_ThrowsCryptographicException()
    {
        var service = new AesGcmCertificateEncryptionService(TestKey);
        var originalData = Encoding.UTF8.GetBytes("Datos confidenciales");

        var payload = service.Encrypt(originalData);
        payload.Tag[0] ^= 0xAA; // Corromper autenticación

        var act = () => service.Decrypt(payload.Ciphertext, payload.Nonce, payload.Tag);
        act.Should().Throw<CryptographicException>();
    }

    [Fact(DisplayName = "Decrypt con clave diferente no puede autenticar ni descifrar")]
    public void Decrypt_DifferentKey_ThrowsCryptographicException()
    {
        var service1 = new AesGcmCertificateEncryptionService(TestKey);
        var wrongKey = SHA256.HashData(Encoding.UTF8.GetBytes("another-different-key-32-bytes!!"));
        var service2 = new AesGcmCertificateEncryptionService(wrongKey);

        var originalData = Encoding.UTF8.GetBytes("Certificado digital confidencial");
        var payload = service1.Encrypt(originalData);

        var act = () => service2.Decrypt(payload.Ciphertext, payload.Nonce, payload.Tag);
        act.Should().Throw<CryptographicException>();
    }

    [Fact(DisplayName = "EncryptPacked y DecryptPacked recuperan exactamente la contraseña o payload original")]
    public void EncryptPacked_And_DecryptPacked_ReturnsOriginalBytes()
    {
        var service = new AesGcmCertificateEncryptionService(TestKey);
        var passwordBytes = Encoding.UTF8.GetBytes("SuperPassword123!");

        var packed = service.EncryptPacked(passwordBytes);

        packed.Should().NotBeNull();
        packed.Length.Should().Be(12 + 16 + passwordBytes.Length);

        var decrypted = service.DecryptPacked(packed);
        decrypted.Should().Equal(passwordBytes);
        Encoding.UTF8.GetString(decrypted).Should().Be("SuperPassword123!");
    }

    [Fact(DisplayName = "Constructor con IConfiguration lanza InvalidOperationException cuando no hay clave maestra configurada")]
    public void Constructor_WithoutMasterKeyInConfig_ThrowsInvalidOperationException()
    {
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
        var act = () => new AesGcmCertificateEncryptionService(config);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*SigningCertificate:MasterKey*");
    }

    [Fact(DisplayName = "Constructor con IConfiguration inicializa correctamente cuando existe clave maestra")]
    public void Constructor_WithMasterKeyInConfig_EncryptsAndDecryptsSuccessfully()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"SigningCertificate:MasterKey", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}
        };
        var config = new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var service = new AesGcmCertificateEncryptionService(config);
        var originalData = Encoding.UTF8.GetBytes("Prueba de cifrado con clave de configuración");
        var payload = service.Encrypt(originalData);
        var decrypted = service.Decrypt(payload.Ciphertext, payload.Nonce, payload.Tag);

        decrypted.Should().Equal(originalData);
    }
}
