using System.Text.Json;
using EcuNexo.Core.Platform;

namespace EcuNexo.Business.Platform.Settings;

public sealed class SettingsResolver : ISettingsResolver
{
    private readonly ISysSettingRepository _repository;

    public SettingsResolver(ISysSettingRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyDictionary<string, JsonElement>> ResolveAsync(
        Guid tenantId,
        Guid userId,
        string planName,
        CancellationToken ct)
    {
        var rows = await _repository.ListForResolutionAsync(tenantId, userId, planName, ct).ConfigureAwait(false);
        var merged = new Dictionary<string, JsonElement>(StringComparer.Ordinal);

        foreach (var scope in new[] { SettingScope.Global, SettingScope.Plan, SettingScope.Tenant, SettingScope.User })
        {
            foreach (var row in rows.Where(r => r.Scope == scope))
            {
                try
                {
                    using var doc = JsonDocument.Parse(row.ValueJson);
                    merged[row.Code] = doc.RootElement.Clone();
                }
                catch (JsonException)
                {
                    /* omitir valor corrupto */
                }
            }
        }

        return merged;
    }
}
