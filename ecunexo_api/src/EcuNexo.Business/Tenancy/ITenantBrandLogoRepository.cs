using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy;

public sealed record TenantBrandLogoMeta(
    Guid Id,
    Guid TenantId,
    string OriginalFileName,
    string Extension,
    string ContentType,
    int ByteSize,
    DateTimeOffset CreatedAt);

public interface ITenantBrandLogoRepository
{
    Task AddAsync(TenantBrandLogo logo, CancellationToken ct);

    Task<int> CountByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<IReadOnlyList<TenantBrandLogoMeta>> ListMetaByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<TenantBrandLogo?> GetByIdAsync(Guid tenantId, Guid logoId, CancellationToken ct);

    Task<TenantBrandLogo?> GetByIdForUpdateAsync(Guid tenantId, Guid logoId, CancellationToken ct);

    Task<bool> ExistsAsync(Guid tenantId, Guid logoId, CancellationToken ct);

    void Remove(TenantBrandLogo logo);
}
