using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class EcuadorGeoRepository : IEcuadorGeoRepository
{
    private readonly EcuNexoDbContext _db;

    public EcuadorGeoRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<EcuadorProvince>> ListProvincesAsync(CancellationToken ct) =>
        await _db.EcuadorProvinces
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public async Task<IReadOnlyList<EcuadorCanton>> ListCantonsByProvinceAsync(
        Guid provinceId,
        CancellationToken ct) =>
        await _db.EcuadorCantons
            .AsNoTracking()
            .Where(c => c.ProvinceId == provinceId && c.IsActive)
            .OrderByDescending(c => c.IsProvincialCapital)
            .ThenBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<EcuadorCanton?> GetCantonByIdAsync(Guid cantonId, CancellationToken ct) =>
        _db.EcuadorCantons
            .AsNoTracking()
            .Include(c => c.Province)
            .FirstOrDefaultAsync(c => c.Id == cantonId, ct);

    public Task<bool> AnyProvincesAsync(CancellationToken ct) =>
        _db.EcuadorProvinces.AsNoTracking().AnyAsync(ct);
}
