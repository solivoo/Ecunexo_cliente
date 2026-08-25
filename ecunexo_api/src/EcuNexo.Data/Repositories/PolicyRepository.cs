using EcuNexo.Business.Identity;
using EcuNexo.Core.Identity;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class PolicyRepository : IPolicyRepository
{
    private readonly EcuNexoDbContext _db;

    public PolicyRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(Policy policy, CancellationToken ct)
    {
        _db.Policies.Add(policy);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<Policy>> ListByPermissionIdAsync(Guid permissionId, CancellationToken ct) =>
        await _db.Policies.AsNoTracking()
            .Where(p => p.PermissionId == permissionId)
            .OrderBy(p => p.CreatedAt)
            .ThenBy(p => p.Id)
            .ToListAsync(ct)
            .ConfigureAwait(false);
}
