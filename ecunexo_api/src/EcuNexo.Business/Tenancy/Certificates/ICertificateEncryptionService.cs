namespace EcuNexo.Business.Tenancy.Certificates;

public sealed record EncryptedPayload(byte[] Ciphertext, byte[] Nonce, byte[] Tag);

public interface ICertificateEncryptionService
{
    EncryptedPayload Encrypt(byte[] plaintext);
    byte[] Decrypt(byte[] ciphertext, byte[] nonce, byte[] tag);
    byte[] EncryptPacked(byte[] plaintext);
    byte[] DecryptPacked(byte[] packed);
}
