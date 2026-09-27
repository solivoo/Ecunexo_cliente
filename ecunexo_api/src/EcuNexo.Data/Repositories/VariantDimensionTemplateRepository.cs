using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class VariantDimensionTemplateRepository : IVariantDimensionTemplateRepository
{
    private readonly EcuNexoDbContext _db;

    public VariantDimensionTemplateRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<VariantDimensionTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct)
    {
        return await _db.VariantDimensionTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.DimensionType)
            .ThenBy(t => t.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<VariantDimensionTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct) =>
        _db.VariantDimensionTemplates
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);

    public async Task<bool> ExistsByNameAsync(
        Guid tenantId,
        string name,
        Guid? excludeId,
        CancellationToken ct)
    {
        var trimmed = name.Trim();
        if (trimmed.Length == 0)
        {
            return false;
        }

        var pattern = trimmed
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

        var query = _db.VariantDimensionTemplates.AsNoTracking()
            .Where(t => t.TenantId == tenantId && EF.Functions.ILike(t.Name, pattern, "\\"));

        if (excludeId.HasValue)
        {
            query = query.Where(t => t.Id != excludeId.Value);
        }

        return await query.AnyAsync(ct).ConfigureAwait(false);
    }

    public Task AddAsync(VariantDimensionTemplate template, CancellationToken ct)
    {
        _db.VariantDimensionTemplates.Add(template);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(VariantDimensionTemplate template, CancellationToken ct)
    {
        _db.VariantDimensionTemplates.Remove(template);
        return Task.CompletedTask;
    }
}
