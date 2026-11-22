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

    public async Task<EcuadorCanton?> FindCantonByNameAsync(string name, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var trimmed = name.Trim();
        return await _db.EcuadorCantons
            .AsNoTracking()
            .Include(c => c.Province)
            .FirstOrDefaultAsync(c => c.IsActive && EF.Functions.ILike(c.Name, trimmed), ct)
            .ConfigureAwait(false);
    }

    public Task<bool> AnyProvincesAsync(CancellationToken ct) =>
        _db.EcuadorProvinces.AsNoTracking().AnyAsync(ct);
}
