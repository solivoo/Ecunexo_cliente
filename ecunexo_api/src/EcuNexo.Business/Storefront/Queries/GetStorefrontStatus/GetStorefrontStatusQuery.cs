using System.Globalization;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Queries.GetStorefrontStatus;

public sealed record GetStorefrontStatusQuery(Guid TenantId) : IQuery<StorefrontStatusDto>;

/// <summary>Revisión del catálogo público: cambia cuando algo que ve la tienda se modifica.</summary>
public sealed record StorefrontStatusDto(
    string Revision,
    DateTimeOffset? UpdatedAt,
    bool MaintenanceEnabled = false,
    string MaintenanceMessage = "");

public sealed class GetStorefrontStatusHandler
    : IQueryHandler<GetStorefrontStatusQuery, StorefrontStatusDto>
{
    private const int CacheSeconds = 10;

    private readonly ITenantRepository _tenants;
    private readonly IStorefrontCatalogRepository _catalog;
    private readonly IEcommerceStorefrontSettingsReader _storefrontSettings;
    private readonly IMemoryCache _cache;

    public GetStorefrontStatusHandler(
        ITenantRepository tenants,
        IStorefrontCatalogRepository catalog,
        IEcommerceStorefrontSettingsReader storefrontSettings,
        IMemoryCache cache)
    {
        _tenants = tenants;
        _catalog = catalog;
        _storefrontSettings = storefrontSettings;
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
        var settings = await _storefrontSettings
            .ResolveAsync(query.TenantId, ct)
            .ConfigureAwait(false);

        var dto = new StorefrontStatusDto(
            lastChange?.UtcTicks.ToString(CultureInfo.InvariantCulture) ?? "0",
            lastChange,
            settings.MaintenanceEnabled,
            settings.MaintenanceMessage);

        _cache.Set(cacheKey, dto, TimeSpan.FromSeconds(CacheSeconds));
        return Result.Success(dto);
    }
}
