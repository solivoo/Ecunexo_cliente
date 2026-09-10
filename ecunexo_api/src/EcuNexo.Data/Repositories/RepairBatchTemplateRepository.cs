using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Repairs;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RepairBatchTemplateRepository : IRepairBatchTemplateRepository
{
    private readonly EcuNexoDbContext _db;

    public RepairBatchTemplateRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(RepairBatchTemplate template, CancellationToken ct)
    {
        _db.RepairBatchTemplates.Add(template);
        return Task.CompletedTask;
    }

    public Task<RepairBatchTemplate?> GetByIdAsync(Guid tenantId, Guid templateId, CancellationToken ct) =>
        _db.RepairBatchTemplates.AsNoTracking()
            .Include(t => t.Customer)
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == templateId, ct);

    public async Task<IReadOnlyList<RepairBatchTemplate>> ListByTenantAsync(Guid tenantId, CancellationToken ct) =>
        await _db.RepairBatchTemplates.AsNoTracking()
            .Include(t => t.Customer)
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<RepairBatchTemplate?> GetDefaultOrActiveForCustomerAsync(Guid tenantId, Guid? customerId, CancellationToken ct) =>
        _db.RepairBatchTemplates.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.IsActive && (!customerId.HasValue || t.CustomerId == customerId || t.CustomerId == null))
            .OrderByDescending(t => t.CustomerId.HasValue) // Primero específicas del cliente, luego generales
            .ThenByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync(ct);
}
