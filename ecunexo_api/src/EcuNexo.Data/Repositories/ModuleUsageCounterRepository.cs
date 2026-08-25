using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ModuleUsageCounterRepository : IModuleUsageCounterRepository
{
    private readonly EcuNexoDbContext _db;

    public ModuleUsageCounterRepository(EcuNexoDbContext db) => _db = db;

    public Task<ModuleUsageCounter?> GetAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        CancellationToken ct) =>
        _db.Set<ModuleUsageCounter>()
            .FirstOrDefaultAsync(c =>
                c.TenantId == tenantId
                && c.ModuleCode == moduleCode
                && c.LimitKey == limitKey, ct);

    public async Task AddAsync(ModuleUsageCounter counter, CancellationToken ct)
    {
        await _db.Set<ModuleUsageCounter>().AddAsync(counter, ct).ConfigureAwait(false);
    }
}
