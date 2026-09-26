using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Storefront;

public sealed record StorefrontDomainDto(
    Guid Id,
    string Domain,
    bool IsPrimary,
    bool IsVerified,
    string TxtRecordName,
    string TxtRecordValue,
    DateTimeOffset? VerifiedAt,
    DateTimeOffset CreatedAt)
{
    public static StorefrontDomainDto FromEntity(StorefrontDomain domain) =>
        new(
            domain.Id,
            domain.Domain,
            domain.IsPrimary,
            domain.IsVerified,
            domain.TxtRecordName,
            domain.TxtRecordValue,
            domain.VerifiedAt,
            domain.CreatedAt);
}
