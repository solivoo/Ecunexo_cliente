using System.Text;
using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Certificates.Commands.UploadSigningCertificate;

public sealed class UploadSigningCertificateHandler
    : ICommandHandler<UploadSigningCertificateCommand, SigningCertificateStatusResponse>
{
    private readonly ITenantRepository _tenantRepository;
    private readonly ITenantSigningCertificateRepository _certificateRepository;
    private readonly ISigningCertificateValidator _validator;
    private readonly ICertificateEncryptionService _encryptionService;
    private readonly IUnitOfWork _unitOfWork;

    public UploadSigningCertificateHandler(
        ITenantRepository tenantRepository,
        ITenantSigningCertificateRepository certificateRepository,
        ISigningCertificateValidator validator,
        ICertificateEncryptionService encryptionService,
        IUnitOfWork unitOfWork)
    {
        _tenantRepository = tenantRepository;
        _certificateRepository = certificateRepository;
        _validator = validator;
        _encryptionService = encryptionService;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SigningCertificateStatusResponse>> Handle(
        UploadSigningCertificateCommand command,
        CancellationToken ct)
    {
        var tenant = await _tenantRepository.GetByIdAsync(command.TenantId, ct)
            .ConfigureAwait(false);

        if (tenant == null)
        {
            return Result.Failure<SigningCertificateStatusResponse>(
                new Error("tenancy.tenant.not_found", "La empresa o tenant especificado no existe.", ErrorType.NotFound));
        }

        // 1. Validar certificado en memoria y extraer metadatos
        var validationResult = _validator.Validate(command.P12Bytes, command.Password);
        if (validationResult.IsFailure)
        {
            return Result.Failure<SigningCertificateStatusResponse>(validationResult.Error!);
        }

        var certInfo = validationResult.Value!;

        if (!string.IsNullOrWhiteSpace(tenant.TaxId))
        {
            var tenantTaxId = new string(tenant.TaxId.Where(char.IsDigit).ToArray());
            var certTaxId = !string.IsNullOrWhiteSpace(certInfo.SubjectTaxId)
                ? new string(certInfo.SubjectTaxId.Where(char.IsDigit).ToArray())
                : null;

            if (certTaxId != null && certTaxId.Length == 13 && tenantTaxId.Length == 13 && certTaxId != tenantTaxId)
            {
                return Result.Failure<SigningCertificateStatusResponse>(
                    new Error(
                        "certificate.tax_id_mismatch",
                        $"El RUC del certificado digital subido ({certTaxId}) no coincide con el RUC de la empresa ({tenantTaxId}). Verifique el archivo .p12.",
                        ErrorType.Validation));
            }
        }

        // 2. Cifrar archivo y contraseña con AES-256-GCM
        var encryptedP12 = _encryptionService.Encrypt(command.P12Bytes);
        var packedPassword = _encryptionService.EncryptPacked(Encoding.UTF8.GetBytes(command.Password));

        // 3. Persistir en repositorio
        var existing = await _certificateRepository.GetActiveByTenantIdAsync(command.TenantId, ct)
            .ConfigureAwait(false);

        TenantSigningCertificate certEntity;

        if (existing != null)
        {
            existing.Update(
                encryptedData: encryptedP12.Ciphertext,
                encryptedPassword: packedPassword,
                nonce: encryptedP12.Nonce,
                tag: encryptedP12.Tag,
                subject: certInfo.Subject,
                issuer: certInfo.Issuer,
                validFrom: certInfo.ValidFrom,
                validTo: certInfo.ValidTo,
                subjectTaxId: certInfo.SubjectTaxId,
                serialNumber: certInfo.SerialNumber,
                originalFileName: command.OriginalFileName);

            await _certificateRepository.UpdateAsync(existing, ct).ConfigureAwait(false);
            certEntity = existing;
        }
        else
        {
            certEntity = TenantSigningCertificate.Create(
                tenantId: command.TenantId,
                encryptedData: encryptedP12.Ciphertext,
                encryptedPassword: packedPassword,
                nonce: encryptedP12.Nonce,
                tag: encryptedP12.Tag,
                subject: certInfo.Subject,
                issuer: certInfo.Issuer,
                validFrom: certInfo.ValidFrom,
                validTo: certInfo.ValidTo,
                subjectTaxId: certInfo.SubjectTaxId,
                serialNumber: certInfo.SerialNumber,
                originalFileName: command.OriginalFileName);

            await _certificateRepository.AddAsync(certEntity, ct).ConfigureAwait(false);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new SigningCertificateStatusResponse(
            IsConfigured: true,
            Subject: certEntity.Subject,
            SubjectTaxId: certEntity.SubjectTaxId,
            Issuer: certEntity.Issuer,
            ValidFrom: certEntity.ValidFrom,
            ValidTo: certEntity.ValidTo,
            SerialNumber: certEntity.SerialNumber,
            DaysRemaining: certEntity.DaysRemaining,
            IsExpired: certEntity.IsExpired,
            OriginalFileName: certEntity.OriginalFileName,
            UpdatedAt: certEntity.UpdatedAt ?? certEntity.CreatedAt));
    }
}
