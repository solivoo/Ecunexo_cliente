using System.Text.Json;
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
        var templates = await _db.VariantDimensionTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.DimensionType)
            .ThenBy(t => t.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (templates.Count == 0)
        {
            // Sembrar escalas por defecto para este tenant si aún no existen
            var defaults = VariantDimensionTemplate.GetSystemDefaultTemplates();
            var seeded = new List<VariantDimensionTemplate>();
            foreach (var (name, dimType, values) in defaults)
            {
                var valuesJson = JsonSerializer.Serialize(values);
                var created = VariantDimensionTemplate.Create(
                    Guid.CreateVersion7(),
                    tenantId,
                    name,
                    dimType,
                    valuesJson,
                    isSystemDefault: true);

                if (created.IsSuccess)
                {
                    _db.VariantDimensionTemplates.Add(created.Value!);
                    seeded.Add(created.Value!);
                }
            }

            if (seeded.Count > 0)
            {
                await _db.SaveChangesAsync(ct).ConfigureAwait(false);
                return seeded;
            }
        }

        return templates;
    }

    public Task<VariantDimensionTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct) =>
        _db.VariantDimensionTemplates
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);

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
