using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Storefront.Queries.ListStorefrontFacets;

public sealed class ListStorefrontFacetsHandler
    : IQueryHandler<ListStorefrontFacetsQuery, StorefrontFacetsDto>
{
    private readonly ITenantRepository _tenants;
    private readonly StorefrontCatalogReader _reader;

    public ListStorefrontFacetsHandler(
        ITenantRepository tenants,
        StorefrontCatalogReader reader)
    {
        _tenants = tenants;
        _reader = reader;
    }

    public async Task<Result<StorefrontFacetsDto>> Handle(
        ListStorefrontFacetsQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontFacetsDto>(tenantError);
        }

        var products = await _reader.LoadAsync(query.TenantId, ct).ConfigureAwait(false);

        var attributes = StorefrontFacetCatalog.Facets
            .Select(definition => BuildAttribute(definition, products))
            .Where(attribute => attribute.Values.Count > 0)
            .ToList();

        var prices = products
            .Where(product => product.Price is not null)
            .Select(product => product.Price!.Value)
            .ToList();

        return Result.Success(new StorefrontFacetsDto(
            attributes,
            prices.Count == 0 ? null : prices.Min(),
            prices.Count == 0 ? null : prices.Max(),
            products.Count(product => product.InStock),
            products.Count(product => product.IsNew)));
    }

    private static StorefrontFacetAttributeDto BuildAttribute(
        StorefrontFacetDefinition definition,
        IReadOnlyList<StorefrontCatalogProduct> products)
    {
        var groups = new Dictionary<string, Dictionary<string, int>>(StringComparer.Ordinal);

        foreach (var product in products)
        {
            if (!product.Attributes.TryGetValue(definition.Key, out var values))
            {
                continue;
            }

            foreach (var value in values)
            {
                var groupKey = StorefrontFacetCatalog.NormalizeForMatch(value);
                if (groupKey.Length == 0)
                {
                    continue;
                }

                if (!groups.TryGetValue(groupKey, out var labels))
                {
                    labels = new Dictionary<string, int>(StringComparer.Ordinal);
                    groups[groupKey] = labels;
                }

                labels[value] = labels.TryGetValue(value, out var count) ? count + 1 : 1;
            }
        }

        var facetValues = groups.Values
            .Select(labels =>
            {
                var count = labels.Values.Sum();
                var label = labels
                    .OrderByDescending(pair => pair.Value)
                    .ThenBy(pair => pair.Key, StringComparer.OrdinalIgnoreCase)
                    .First()
                    .Key;

                return new StorefrontFacetValueDto(label, label, count);
            })
            .OrderByDescending(value => value.Count)
            .ThenBy(value => value.Label, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new StorefrontFacetAttributeDto(definition.Key, definition.Label, facetValues);
    }
}
