using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class TenantBrandLogoRepository : ITenantBrandLogoRepository
{
    private readonly EcuNexoDbContext _db;

    public TenantBrandLogoRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(TenantBrandLogo logo, CancellationToken ct)
    {
        _db.TenantBrandLogos.Add(logo);
        return Task.CompletedTask;
    }

    public Task<int> CountByTenantAsync(Guid tenantId, CancellationToken ct) =>
        _db.TenantBrandLogos.AsNoTracking().CountAsync(x => x.TenantId == tenantId, ct);

    public async Task<IReadOnlyList<TenantBrandLogoMeta>> ListMetaByTenantAsync(
        Guid tenantId,
        CancellationToken ct) =>
        await _db.TenantBrandLogos.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new TenantBrandLogoMeta(
                x.Id,
                x.TenantId,
                x.OriginalFileName,
                x.Extension,
                x.ContentType,
                x.ByteSize,
                x.CreatedAt))
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<TenantBrandLogo?> GetByIdAsync(Guid tenantId, Guid logoId, CancellationToken ct) =>
        _db.TenantBrandLogos.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == logoId, ct);

    public Task<TenantBrandLogo?> GetByIdForUpdateAsync(Guid tenantId, Guid logoId, CancellationToken ct) =>
        _db.TenantBrandLogos.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == logoId, ct);

    public Task<bool> ExistsAsync(Guid tenantId, Guid logoId, CancellationToken ct) =>
        _db.TenantBrandLogos.AsNoTracking().AnyAsync(x => x.TenantId == tenantId && x.Id == logoId, ct);

    public void Remove(TenantBrandLogo logo) => _db.TenantBrandLogos.Remove(logo);
}
