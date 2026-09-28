using System.Globalization;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontStatus;

public sealed record GetStorefrontStatusQuery(Guid TenantId) : IQuery<StorefrontStatusDto>;

/// <summary>Revisión del catálogo público: cambia cuando algo que ve la tienda se modifica.</summary>
public sealed record StorefrontStatusDto(string Revision, DateTimeOffset? UpdatedAt);

public sealed class GetStorefrontStatusHandler
    : IQueryHandler<GetStorefrontStatusQuery, StorefrontStatusDto>
{
    private const int CacheSeconds = 10;

    private readonly ITenantRepository _tenants;
    private readonly IStorefrontCatalogRepository _catalog;
    private readonly IMemoryCache _cache;

    public GetStorefrontStatusHandler(
        ITenantRepository tenants,
        IStorefrontCatalogRepository catalog,
        IMemoryCache cache)
    {
        _tenants = tenants;
        _catalog = catalog;
        _cache = cache;
    }

    public async Task<Result<StorefrontStatusDto>> Handle(
        GetStorefrontStatusQuery query,
        CancellationToken ct)
    {
        var tenantError = await StorefrontTenantGuard
            .ValidateAsync(_tenants, query.TenantId, ct)
            .ConfigureAwait(false);
        if (tenantError is not null)
        {
            return Result.Failure<StorefrontStatusDto>(tenantError);
        }

        var cacheKey = StorefrontCacheKeys.ForStatus(query.TenantId);
        if (_cache.TryGetValue<StorefrontStatusDto>(cacheKey, out var cached) && cached is not null)
        {
            return Result.Success(cached);
        }

        var lastChange = await _catalog
            .GetLastCatalogChangeAtAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        var dto = new StorefrontStatusDto(
            lastChange?.UtcTicks.ToString(CultureInfo.InvariantCulture) ?? "0",
            lastChange);

        _cache.Set(cacheKey, dto, TimeSpan.FromSeconds(CacheSeconds));
        return Result.Success(dto);
    }
}
