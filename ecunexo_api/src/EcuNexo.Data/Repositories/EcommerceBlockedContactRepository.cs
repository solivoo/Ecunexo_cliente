using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class EcommerceBlockedContactRepository : IEcommerceBlockedContactRepository
{
    private readonly EcuNexoDbContext _db;

    public EcommerceBlockedContactRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task<bool> ExistsAsync(
        Guid tenantId,
        EcommerceBlockedContactKind kind,
        string valueNormalized,
        CancellationToken ct = default)
    {
        var value = valueNormalized.Trim();
        return _db.EcommerceBlockedContacts.AsNoTracking()
            .AnyAsync(
                c => c.TenantId == tenantId && c.Kind == kind && c.ValueNormalized == value,
                ct);
    }

    public async Task<IReadOnlyList<EcommerceBlockedContact>> ListAsync(
        Guid tenantId,
        CancellationToken ct = default) =>
        await _db.EcommerceBlockedContacts.AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

    public Task<EcommerceBlockedContact?> GetByIdAsync(
        Guid tenantId,
        Guid contactId,
        CancellationToken ct = default) =>
        _db.EcommerceBlockedContacts
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == contactId, ct);

    public Task AddAsync(EcommerceBlockedContact contact, CancellationToken ct = default)
    {
        _db.EcommerceBlockedContacts.Add(contact);
        return Task.CompletedTask;
    }

    public void Remove(EcommerceBlockedContact contact) => _db.EcommerceBlockedContacts.Remove(contact);
}
