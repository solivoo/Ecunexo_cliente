using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Platform;
using EcuNexo.Data;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Api.Development;

internal static class PlatformSettingsSeeder
{
    public static async Task EnsureAsync(WebApplication app, CancellationToken cancellationToken)
    {
        var seedCatalog = app.Configuration.GetValue(
            "Database:SeedCatalogOnStartup",
            defaultValue: app.Environment.IsDevelopment());
        if (!seedCatalog)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<EcuNexoDbContext>();
        var idGen = scope.ServiceProvider.GetRequiredService<IIdGenerator>();

        var defaults = new (string Code, string ValueJson)[]
        {
            ("ui.realtime.enabled", "false"),
            ("ui.theme.default", "\"system\""),
            (UiPreferenceCodes.Palette, "\"default\""),
            (UiPreferenceCodes.Density, "\"md\""),
            (UiPreferenceCodes.MaxRecords, "10"),
            (UiPreferenceCodes.DefaultLookback, "\"1m\""),
            (UiPreferenceCodes.StartDark, "true"),
            (CatalogSettingCodes.AllowedItemKinds, "[\"physical\",\"service\"]"),
        };

        var added = false;
        foreach (var (code, valueJson) in defaults)
        {
            var exists = await db.SysSettings
                .AsNoTracking()
                .AnyAsync(
                    s => s.Code == code && s.Scope == SettingScope.Global && s.ScopeId == null,
                    cancellationToken)
                .ConfigureAwait(false);
            if (exists)
            {
                continue;
            }

            var row = SysSetting.Create(idGen.NewId(), code, valueJson, SettingScope.Global, null);
            if (!row.IsSuccess)
            {
                continue;
            }

            db.SysSettings.Add(row.Value!);
            added = true;
        }

        if (added)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
