using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Customers;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CustomerTypeDefinitionRepository : ICustomerTypeDefinitionRepository
{
    private static readonly (int Code, string Name, string ShortLabel, string Tone, int Sort)[] SystemDefaults =
    [
        ((int)CustomerType.CorporativoB2B, "Corporativo B2B / Fabricante", "Corporativo B2B", "primary", 1),
        ((int)CustomerType.PersonaNatural, "Persona Natural / Particular", "Persona Natural", "success", 2),
        ((int)CustomerType.DistribuidorMayorista, "Distribuidor / Mayorista", "Distribuidor", "warning", 3),
        ((int)CustomerType.TallerAliado, "Taller Técnico Aliado", "Taller Aliado", "neutral", 4),
        ((int)CustomerType.ConsumidorFinal, "Consumidor Final", "Consumidor Final", "neutral", 5),
        ((int)CustomerType.InstitucionPublica, "Institución Pública / Gobierno", "Sector Público", "warning", 6),
    ];

    private readonly EcuNexoDbContext _db;

    public CustomerTypeDefinitionRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task EnsureSystemDefaultsAsync(Guid tenantId, CancellationToken ct)
    {
        var existingCodes = await _db.CustomerTypeDefinitions
            .IgnoreQueryFilters()
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null)
            .Select(t => t.Code)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var existing = existingCodes.ToHashSet();
        foreach (var def in SystemDefaults)
        {
            if (existing.Contains(def.Code))
            {
                continue;
            }

            var created = CustomerTypeDefinition.CreateSystem(
                Guid.NewGuid(),
                tenantId,
                def.Code,
                def.Name,
                def.ShortLabel,
                def.Tone,
                def.Sort);

            if (created.IsSuccess)
            {
                await _db.CustomerTypeDefinitions.AddAsync(created.Value!, ct).ConfigureAwait(false);
            }
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<CustomerTypeDefinition>> ListAsync(
        Guid tenantId,
        bool activeOnly,
        CancellationToken ct)
    {
        await EnsureSystemDefaultsAsync(tenantId, ct).ConfigureAwait(false);

        var query = _db.CustomerTypeDefinitions.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null);

        if (activeOnly)
        {
            query = query.Where(t => t.IsActive);
        }

        return await query
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<CustomerTypeDefinition?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct) =>
        _db.CustomerTypeDefinitions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == id && t.DeletedAt == null, ct);

    public Task<CustomerTypeDefinition?> GetTrackedByIdAsync(Guid tenantId, Guid id, CancellationToken ct) =>
        _db.CustomerTypeDefinitions
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Id == id && t.DeletedAt == null, ct);

    public Task<CustomerTypeDefinition?> GetByCodeAsync(Guid tenantId, int code, CancellationToken ct) =>
        _db.CustomerTypeDefinitions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Code == code && t.DeletedAt == null, ct);

    public Task<bool> ExistsByNameAsync(Guid tenantId, string name, Guid? excludeId, CancellationToken ct) =>
        _db.CustomerTypeDefinitions.AsNoTracking()
            .AnyAsync(
                t => t.TenantId == tenantId
                    && t.DeletedAt == null
                    && EF.Functions.ILike(t.Name, name.Trim())
                    && (excludeId == null || t.Id != excludeId.Value),
                ct);

    public async Task<int> GetNextCustomCodeAsync(Guid tenantId, CancellationToken ct)
    {
        var max = await _db.CustomerTypeDefinitions.AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.DeletedAt == null)
            .Select(t => (int?)t.Code)
            .MaxAsync(ct)
            .ConfigureAwait(false);

        var next = Math.Max(CustomerTypeDefinition.CustomCodeStart, (max ?? 0) + 1);
        if (next < CustomerTypeDefinition.CustomCodeStart)
        {
            next = CustomerTypeDefinition.CustomCodeStart;
        }

        return next;
    }

    public async Task AddAsync(CustomerTypeDefinition entity, CancellationToken ct) =>
        await _db.CustomerTypeDefinitions.AddAsync(entity, ct).ConfigureAwait(false);
}
