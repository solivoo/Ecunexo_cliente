using DnsClient;
using EcuNexo.Business.Storefront;

namespace EcuNexo.Api.Tenancy;

public sealed class DnsTxtDomainVerifier : IDomainOwnershipVerifier
{
    private readonly LookupClient _lookup = new();

    public async Task<bool> HasTxtRecordAsync(
        string domain,
        string expectedValue,
        CancellationToken ct)
    {
        try
        {
            var response = await _lookup
                .QueryAsync(domain, QueryType.TXT, cancellationToken: ct)
                .ConfigureAwait(false);

            var expected = expectedValue.Trim();
            return response.Answers
                .TxtRecords()
                .Select(record => string.Concat(record.Text).Trim())
                .Any(text => string.Equals(text, expected, StringComparison.OrdinalIgnoreCase));
        }
        catch (DnsResponseException)
        {
            return false;
        }
    }
}
