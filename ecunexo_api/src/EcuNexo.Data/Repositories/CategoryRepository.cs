using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CategoryRepository : ICategoryRepository
{
    private readonly EcuNexoDbContext _db;

    public CategoryRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Category category, CancellationToken ct)
    {
        _db.Categories.Add(category);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Category>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.Categories.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<Category?> GetActiveByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct) =>
        _db.Categories.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.TenantId == tenantId && c.Id == categoryId && c.DeletedAt == null,
                ct);

    public Task<Category?> GetTrackedByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct) =>
        _db.Categories.FirstOrDefaultAsync(
            c => c.TenantId == tenantId && c.Id == categoryId && c.DeletedAt == null,
            ct);

    public async Task<bool> NameExistsIgnoreCaseAsync(
        Guid tenantId,
        string name,
        Guid? excludeId,
        CancellationToken ct)
    {
        var trimmed = name.Trim();
        var query = _db.Categories.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);
        if (excludeId.HasValue)
        {
            query = query.Where(c => c.Id != excludeId.Value);
        }

        var names = await query.Select(c => c.Name).ToListAsync(ct).ConfigureAwait(false);
        return names.Exists(n => string.Equals(n, trimmed, StringComparison.OrdinalIgnoreCase));
    }

    public Task<bool> ExistsActiveByIdAsync(Guid tenantId, Guid categoryId, CancellationToken ct) =>
        _db.Categories.AsNoTracking().AnyAsync(
            c => c.TenantId == tenantId && c.Id == categoryId && c.DeletedAt == null,
            ct);
}
