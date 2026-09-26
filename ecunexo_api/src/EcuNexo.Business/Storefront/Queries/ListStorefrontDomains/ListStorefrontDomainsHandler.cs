using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontDomains;

public sealed class ListStorefrontDomainsHandler
    : IQueryHandler<ListStorefrontDomainsQuery, IReadOnlyList<StorefrontDomainDto>>
{
    private readonly IStorefrontDomainRepository _domains;

    public ListStorefrontDomainsHandler(IStorefrontDomainRepository domains)
    {
        _domains = domains;
    }

    public async Task<Result<IReadOnlyList<StorefrontDomainDto>>> Handle(
        ListStorefrontDomainsQuery query,
        CancellationToken ct)
    {
        var domains = await _domains
            .ListByTenantAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        IReadOnlyList<StorefrontDomainDto> dtos = domains
            .Select(StorefrontDomainDto.FromEntity)
            .ToList();

        return Result.Success(dtos);
    }
}
