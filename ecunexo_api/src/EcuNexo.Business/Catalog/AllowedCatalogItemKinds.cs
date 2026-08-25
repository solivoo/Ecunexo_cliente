using System.Text.Json;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Platform;

namespace EcuNexo.Business.Catalog;

internal static class AllowedCatalogItemKinds
{
    public static async Task<Result> EnsureAllowedAsync(
        ISysSettingRepository settings,
        Guid tenantId,
        CatalogItemKind kind,
        CancellationToken ct)
    {
        var allowed = await ResolveAsync(settings, tenantId, ct).ConfigureAwait(false);
        if (allowed.Count == 0 || allowed.Contains(kind))
        {
            return Result.Success();
        }

        var label = kind == CatalogItemKind.Physical ? "físico" : "servicio";
        return Result.Failure(
            new Error(
                "catalog.item.kind.not_allowed",
                $"El plan o la configuración del tenant no permite ítems de tipo {label}.",
                ErrorType.Forbidden));
    }

    public static async Task<IReadOnlySet<CatalogItemKind>> ResolveAsync(
        ISysSettingRepository settings,
        Guid tenantId,
        CancellationToken ct)
    {
        var tenantRow = await settings
            .GetAsync(CatalogSettingCodes.AllowedItemKinds, SettingScope.Tenant, tenantId.ToString("D"), ct)
            .ConfigureAwait(false);
        if (tenantRow is not null && TryParse(tenantRow.ValueJson, out var fromTenant))
        {
            return fromTenant;
        }

        var globalRow = await settings
            .GetAsync(CatalogSettingCodes.AllowedItemKinds, SettingScope.Global, null, ct)
            .ConfigureAwait(false);
        if (globalRow is not null && TryParse(globalRow.ValueJson, out var fromGlobal))
        {
            return fromGlobal;
        }

        return new HashSet<CatalogItemKind> { CatalogItemKind.Physical, CatalogItemKind.Service };
    }

    private static bool TryParse(string valueJson, out IReadOnlySet<CatalogItemKind> kinds)
    {
        kinds = new HashSet<CatalogItemKind>();
        try
        {
            using var doc = JsonDocument.Parse(valueJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            var set = new HashSet<CatalogItemKind>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind == JsonValueKind.String)
                {
                    var raw = el.GetString()?.Trim().ToLowerInvariant();
                    if (raw is "physical" or "fisico" or "físico")
                    {
                        set.Add(CatalogItemKind.Physical);
                    }
                    else if (raw is "service" or "servicio")
                    {
                        set.Add(CatalogItemKind.Service);
                    }
                }
                else if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)
                         && Enum.IsDefined((CatalogItemKind)n))
                {
                    set.Add((CatalogItemKind)n);
                }
            }

            if (set.Count == 0)
            {
                return false;
            }

            kinds = set;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
