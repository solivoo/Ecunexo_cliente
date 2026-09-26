using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Caching.Memory;

namespace EcuNexo.Business.Storefront.Queries.ResolveStorefront;

public sealed class ResolveStorefrontHandler
    : IQueryHandler<ResolveStorefrontQuery, StorefrontResolveResponse>
{
    private const int CacheSeconds = 60;
    private const string DefaultLocale = "es-EC";
    private const string DefaultCurrency = "USD";

    private readonly IStorefrontDomainRepository _domains;
    private readonly ITenantRepository _tenants;
    private readonly IMemoryCache _cache;

    public ResolveStorefrontHandler(
        IStorefrontDomainRepository domains,
        ITenantRepository tenants,
        IMemoryCache cache)
    {
        _domains = domains;
        _tenants = tenants;
        _cache = cache;
    }

    public async Task<Result<StorefrontResolveResponse>> Handle(
        ResolveStorefrontQuery query,
        CancellationToken ct)
    {
        var normalized = StorefrontDomain.NormalizeDomain(query.Host);
        if (normalized.IsFailure)
        {
            return Result.Failure<StorefrontResolveResponse>(StorefrontTenantGuard.TenantNotFound);
        }

        var host = normalized.Value!;
        var cacheKey = StorefrontCacheKeys.ForHost(host);

        if (_cache.TryGetValue(cacheKey, out StorefrontResolveResponse? cached) && cached is not null)
        {
            return Result.Success(cached);
        }

        var domain = await _domains.GetVerifiedByHostAsync(host, ct).ConfigureAwait(false);
        if (domain is null)
        {
            return Result.Failure<StorefrontResolveResponse>(StorefrontTenantGuard.TenantNotFound);
        }

        var tenant = await _tenants.GetByIdAsync(domain.TenantId, ct).ConfigureAwait(false);
        if (tenant is null
            || tenant.Status is TenantStatus.Suspended or TenantStatus.Cancelled
            || !tenant.HasModuleWithMinTier(TenantModuleCodes.Ecommerce))
        {
            return Result.Failure<StorefrontResolveResponse>(StorefrontTenantGuard.TenantNotFound);
        }

        var response = new StorefrontResolveResponse(
            tenant.Id,
            tenant.Name,
            tenant.LogoUrl,
            tenant.PrimaryColorHex,
            tenant.Locale ?? DefaultLocale,
            DefaultCurrency);

        _cache.Set(cacheKey, response, TimeSpan.FromSeconds(CacheSeconds));
        return Result.Success(response);
    }
}
