using EcuNexo.Business.Inventory;
using EcuNexo.Core.Inventory;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class InventoryDocumentRepository : IInventoryDocumentRepository
{
    private readonly EcuNexoDbContext _db;

    public InventoryDocumentRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(InventoryDocument document, CancellationToken ct)
    {
        _db.InventoryDocuments.Add(document);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<InventoryDocument>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.InventoryDocuments.AsNoTracking()
            .Include(d => d.Lines)
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<InventoryDocument?> GetByIdAsync(Guid tenantId, Guid documentId, CancellationToken ct) =>
        _db.InventoryDocuments.AsNoTracking()
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == documentId, ct);

    public Task<InventoryDocument?> GetTrackedWithLinesAsync(Guid tenantId, Guid documentId, CancellationToken ct) =>
        _db.InventoryDocuments
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.Id == documentId, ct);
}
