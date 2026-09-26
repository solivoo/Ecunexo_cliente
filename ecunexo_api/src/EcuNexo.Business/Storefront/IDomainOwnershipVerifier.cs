namespace EcuNexo.Business.Storefront;

public interface IDomainOwnershipVerifier
{
    Task<bool> HasTxtRecordAsync(string domain, string expectedValue, CancellationToken ct);
}
