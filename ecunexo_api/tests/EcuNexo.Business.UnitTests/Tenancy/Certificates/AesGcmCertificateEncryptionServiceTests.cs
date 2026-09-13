using System.Security.Cryptography;
using System.Text;
using EcuNexo.Business.Tenancy.Certificates;

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
}
