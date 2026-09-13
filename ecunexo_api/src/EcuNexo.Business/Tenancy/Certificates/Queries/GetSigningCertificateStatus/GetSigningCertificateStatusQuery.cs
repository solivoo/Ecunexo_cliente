using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Certificates.Queries.GetSigningCertificateStatus;

public sealed record GetSigningCertificateStatusQuery(Guid TenantId)
    : IQuery<SigningCertificateStatusResponse>;
