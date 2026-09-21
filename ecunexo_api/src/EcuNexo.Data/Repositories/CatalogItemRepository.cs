using EcuNexo.Business.Catalog;
using EcuNexo.Core.Catalog;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CatalogItemRepository : ICatalogItemRepository
{
    private readonly EcuNexoDbContext _db;

    public CatalogItemRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(CatalogItem item, CancellationToken ct)
    {
        _db.CatalogItems.Add(item);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<CatalogItem>> ListActiveByTenantAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CatalogItemStatus? status,
        CancellationToken ct)
    {
        var query = _db.CatalogItems.AsNoTracking()
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null);
        if (kind.HasValue)
        {
            query = query.Where(i => i.Kind == kind.Value);
        }
        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }

        return await query
            .OrderBy(i => i.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<bool> IsAttributeTemplateInUseAsync(
        Guid tenantId,
        string templateName,
        CancellationToken ct)
    {
        var trimmed = templateName.Trim();
        var inUseNames = await GetInUseAttributeTemplateNamesAsync(tenantId, ct).ConfigureAwait(false);
        return inUseNames.Contains(trimmed);
    }

    public async Task<HashSet<string>> GetInUseAttributeTemplateNamesAsync(
        Guid tenantId,
        CancellationToken ct)
    {
        var activeItems = await _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null)
            .Select(i => new { i.CustomAttributesJson, i.VariantDimensionsJson })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in activeItems)
        {
            if (!string.IsNullOrWhiteSpace(item.CustomAttributesJson) && item.CustomAttributesJson != "{}")
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(item.CustomAttributesJson);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        set.Add(prop.Name);
                    }
                }
                catch
                {
                    // Ignorar json malformado
                }
            }

            if (!string.IsNullOrWhiteSpace(item.VariantDimensionsJson) && item.VariantDimensionsJson != "[]")
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(item.VariantDimensionsJson);
                    if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var el in doc.RootElement.EnumerateArray())
                        {
                            if (el.TryGetProperty("Name", out var nameProp) || el.TryGetProperty("name", out nameProp))
                            {
                                var n = nameProp.GetString();
                                if (!string.IsNullOrWhiteSpace(n))
                                {
                                    set.Add(n);
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // Ignorar json malformado
                }
            }
        }

        return set;
    }

    public Task<CatalogItem?> GetActiveByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct) =>
        _db.CatalogItems.AsNoTracking()
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
                .ThenInclude(v => v.Images.OrderBy(img => img.DisplayOrder))
            .FirstOrDefaultAsync(
                i => i.TenantId == tenantId && i.Id == itemId && i.DeletedAt == null,
                ct);

    public Task<CatalogItem?> GetTrackedByIdAsync(Guid tenantId, Guid itemId, CancellationToken ct) =>
        _db.CatalogItems
            .Include(i => i.Images.OrderBy(img => img.DisplayOrder))
            .Include(i => i.Variants.Where(v => v.DeletedAt == null))
                .ThenInclude(v => v.Images.OrderBy(img => img.DisplayOrder))
            .FirstOrDefaultAsync(
                i => i.TenantId == tenantId && i.Id == itemId && i.DeletedAt == null,
                ct);

    public async Task<IReadOnlyList<CatalogItem>> GetActiveByIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct)
    {
        if (ids.Count == 0)
        {
            return [];
        }

        return await _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null && ids.Contains(i.Id))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<bool> SkuExistsIgnoreCaseAsync(
        Guid tenantId,
        string sku,
        Guid? excludeId,
        CancellationToken ct)
    {
        var trimmed = sku.Trim();
        var query = _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null && i.Sku != null);
        if (excludeId.HasValue)
        {
            query = query.Where(i => i.Id != excludeId.Value);
        }

        return await query.AnyAsync(i => EF.Functions.ILike(i.Sku!, trimmed), ct).ConfigureAwait(false);
    }

    public Task<bool> ExistsForCategoryAsync(Guid tenantId, Guid categoryId, CancellationToken ct) =>
        _db.CatalogItems.AsNoTracking().AnyAsync(
            i => i.TenantId == tenantId && i.CategoryId == categoryId && i.DeletedAt == null,
            ct);

    public Task<int> CountVariantsAsync(Guid tenantId, bool onlyActive, CancellationToken ct)
    {
        var query = _db.CatalogItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.ParentId != null && i.DeletedAt == null);

        if (onlyActive)
        {
            query = query.Where(i => i.Status == CatalogItemStatus.Active);
        }

        return query.CountAsync(ct);
    }
}
