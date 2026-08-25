using EcuNexo.Core.Platform;

namespace EcuNexo.Business.Platform;

public interface ISysSettingRepository
{
    Task<IReadOnlyList<SysSetting>> ListForResolutionAsync(
        Guid tenantId,
        Guid userId,
        string planName,
        CancellationToken ct);

    Task<SysSetting?> GetAsync(
        string code,
        SettingScope scope,
        string? scopeId,
        CancellationToken ct);

    Task AddAsync(SysSetting setting, CancellationToken ct);
}
