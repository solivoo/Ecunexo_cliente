using System.Text.Json;
using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Platform.Queries.GetResolvedSettings;

public sealed record GetResolvedSettingsQuery(
    Guid ActorId,
    Guid? TenantId,
    bool IsSubscriptionHolder) : IQuery<GetResolvedSettingsResponse>;

public sealed record GetResolvedSettingsResponse(
    IReadOnlyDictionary<string, JsonElement> Settings);
