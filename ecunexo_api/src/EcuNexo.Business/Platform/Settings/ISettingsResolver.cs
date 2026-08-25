using System.Text.Json;

namespace EcuNexo.Business.Platform.Settings;

public interface ISettingsResolver
{
    Task<IReadOnlyDictionary<string, JsonElement>> ResolveAsync(
        Guid tenantId,
        Guid userId,
        string planName,
        CancellationToken ct);
}
