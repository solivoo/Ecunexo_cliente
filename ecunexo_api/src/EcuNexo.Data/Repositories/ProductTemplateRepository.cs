using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ProductTemplateRepository : IProductTemplateRepository
{
    private readonly EcuNexoDbContext _db;

    public ProductTemplateRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ProductTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct)
    {
        return await _db.ProductTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Name)
            .ToListAsync(ct);
    }

    public Task<ProductTemplate?> GetByIdAsync(Guid id, Guid tenantId, CancellationToken ct) =>
        _db.ProductTemplates
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);

    public async Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct)
    {
        var trimmed = name.Trim();
        var query = _db.ProductTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && EF.Functions.ILike(t.Name, trimmed));

        if (excludeId.HasValue && excludeId.Value != Guid.Empty)
        {
            query = query.Where(t => t.Id != excludeId.Value);
        }

        return await query.AnyAsync(ct).ConfigureAwait(false);
    }

    public Task<int> CountByTenantAsync(Guid tenantId, CancellationToken ct) =>
        _db.ProductTemplates
            .AsNoTracking()
            .CountAsync(t => t.TenantId == tenantId, ct);

    public Task AddAsync(ProductTemplate template, CancellationToken ct)
    {
        _db.ProductTemplates.Add(template);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(ProductTemplate template, CancellationToken ct)
    {
        _db.ProductTemplates.Remove(template);
        return Task.CompletedTask;
    }
}
