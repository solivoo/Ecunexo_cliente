using EcuNexo.Business.Platform;
using EcuNexo.Core.Platform;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class SysSettingRepository : ISysSettingRepository
{
    private readonly EcuNexoDbContext _db;

    public SysSettingRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<SysSetting>> ListForResolutionAsync(
        Guid tenantId,
        Guid userId,
        string planName,
        CancellationToken ct)
    {
        var tenantKey = tenantId.ToString("D");
        var userKey = userId.ToString("D");

        return await _db.SysSettings.AsNoTracking()
            .Where(s =>
                (s.Scope == SettingScope.Global && s.ScopeId == null)
                || (s.Scope == SettingScope.Plan && s.ScopeId == planName)
                || (s.Scope == SettingScope.Tenant && s.ScopeId == tenantKey)
                || (s.Scope == SettingScope.User && s.ScopeId == userKey))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<SysSetting?> GetAsync(
        string code,
        SettingScope scope,
        string? scopeId,
        CancellationToken ct)
    {
        var normalized = code.Trim().ToLowerInvariant();
        return await _db.SysSettings
            .FirstOrDefaultAsync(
                s => s.Code == normalized && s.Scope == scope && s.ScopeId == scopeId,
                ct)
            .ConfigureAwait(false);
    }

    public async Task AddAsync(SysSetting setting, CancellationToken ct)
    {
        await _db.SysSettings.AddAsync(setting, ct).ConfigureAwait(false);
    }
}
