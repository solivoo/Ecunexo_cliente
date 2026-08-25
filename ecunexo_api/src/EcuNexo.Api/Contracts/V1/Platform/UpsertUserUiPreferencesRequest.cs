using EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;

namespace EcuNexo.Api.Contracts.V1.Platform;

public sealed record UpsertUserUiPreferencesRequest(
    int MaxRecords,
    string Palette,
    string Density,
    bool StartDarkMode,
    string DefaultLookback = "1m")
{
    public UpsertUserUiPreferencesCommand ToCommand(Guid actorId, Guid? tenantId, bool isHolder) =>
        new(
            actorId,
            tenantId,
            isHolder,
            MaxRecords,
            Palette.Trim().ToLowerInvariant(),
            Density.Trim().ToLowerInvariant(),
            StartDarkMode,
            (DefaultLookback ?? "1m").Trim().ToLowerInvariant());
}
