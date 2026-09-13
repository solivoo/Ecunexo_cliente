using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Certificates.Commands.UploadSigningCertificate;

public sealed record UploadSigningCertificateCommand(
    Guid TenantId,
    byte[] P12Bytes,
    string Password,
    string? OriginalFileName = null) : ICommand<SigningCertificateStatusResponse>;
