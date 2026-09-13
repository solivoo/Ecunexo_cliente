using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Certificates.Queries.GetSigningCertificateStatus;

public sealed class GetSigningCertificateStatusHandler
    : IQueryHandler<GetSigningCertificateStatusQuery, SigningCertificateStatusResponse>
{
    private readonly ITenantSigningCertificateRepository _certificateRepository;

    public GetSigningCertificateStatusHandler(ITenantSigningCertificateRepository certificateRepository)
    {
        _certificateRepository = certificateRepository;
    }

    public async Task<Result<SigningCertificateStatusResponse>> Handle(
        GetSigningCertificateStatusQuery query,
        CancellationToken ct)
    {
        var cert = await _certificateRepository.GetActiveByTenantIdAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        if (cert == null || !cert.IsActive)
        {
            return Result.Success(new SigningCertificateStatusResponse(
                IsConfigured: false,
                Subject: null,
                SubjectTaxId: null,
                Issuer: null,
                ValidFrom: null,
                ValidTo: null,
                SerialNumber: null,
                DaysRemaining: 0,
                IsExpired: false,
                OriginalFileName: null,
                UpdatedAt: null));
        }

        return Result.Success(new SigningCertificateStatusResponse(
            IsConfigured: true,
            Subject: cert.Subject,
            SubjectTaxId: cert.SubjectTaxId,
            Issuer: cert.Issuer,
            ValidFrom: cert.ValidFrom,
            ValidTo: cert.ValidTo,
            SerialNumber: cert.SerialNumber,
            DaysRemaining: cert.DaysRemaining,
            IsExpired: cert.IsExpired,
            OriginalFileName: cert.OriginalFileName,
            UpdatedAt: cert.UpdatedAt ?? cert.CreatedAt));
    }
}
