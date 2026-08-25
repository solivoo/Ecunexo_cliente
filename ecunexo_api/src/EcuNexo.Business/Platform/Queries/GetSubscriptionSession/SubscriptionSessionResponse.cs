using System.Text.Json;
using EcuNexo.Core.Tenancy;
using EcuNexo.Business.Platform.Queries.GetSession;

namespace EcuNexo.Business.Platform.Queries.GetSubscriptionSession;

public sealed record SubscriptionSessionResponse(
    SessionUserDto User,
    SubscriptionAccountSessionDto Subscription,
    IReadOnlyList<string> Permissions,
    IReadOnlyDictionary<string, JsonElement> Settings,
    IReadOnlyList<NavigationNodeDto> Navigation,
    IReadOnlyList<string> MenuContexts,
    string PermVersion,
    bool IsSubscriptionHolder);

public sealed record SubscriptionAccountSessionDto(
    Guid Id,
    string ServicePlanName,
    int MaxUsers,
    int MaxWarehouses,
    int SubscriptionMaxTenants,
    IReadOnlyList<string>? EnabledModules,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    IReadOnlyDictionary<string, int>? ResolvedLimits);
