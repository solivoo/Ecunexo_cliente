using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;

public sealed record UpsertUserUiPreferencesCommand(
    Guid ActorId,
    Guid? TenantId,
    bool IsSubscriptionHolder,
    int MaxRecords,
    string Palette,
    string Density,
    bool StartDarkMode,
    string DefaultLookback = "1m") : ICommand<UpsertUserUiPreferencesResponse>;

public sealed record UpsertUserUiPreferencesResponse(
    IReadOnlyDictionary<string, System.Text.Json.JsonElement> Settings);
