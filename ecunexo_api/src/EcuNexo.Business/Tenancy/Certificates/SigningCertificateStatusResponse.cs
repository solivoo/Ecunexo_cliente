namespace EcuNexo.Business.Tenancy.Certificates;

public sealed record SigningCertificateStatusResponse(
    bool IsConfigured,
    string? Subject,
    string? SubjectTaxId,
    string? Issuer,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    string? SerialNumber,
    int DaysRemaining,
    bool IsExpired,
    string? OriginalFileName,
    DateTimeOffset? UpdatedAt);
