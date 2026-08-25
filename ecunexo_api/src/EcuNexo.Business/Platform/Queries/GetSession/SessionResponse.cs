using System.Text.Json;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Platform.Queries.GetSession;

public sealed record SessionResponse(
    SessionUserDto User,
    SessionTenantDto Tenant,
    IReadOnlyList<string> Permissions,
    IReadOnlyDictionary<string, JsonElement> Settings,
    IReadOnlyList<NavigationNodeDto> Navigation,
    IReadOnlyList<string> MenuContexts,
    string PermVersion);

public sealed record SessionUserDto(
    Guid Id,
    string Email,
    string Name,
    string? Department,
    string? Phone,
    string? JobTitle,
    IReadOnlyList<Guid> RoleIds);

public sealed record SessionTenantDto(
    Guid Id,
    string Name,
    string? TimeZoneId,
    string? Locale,
    string? LogoUrl,
    string? LogoLightUrl,
    string? LogoDarkUrl,
    bool PreferWordmark,
    string? PrimaryColorHex,
    TenantStatus Status,
    string ServicePlanName,
    int MaxUsers,
    int MaxWarehouses,
    int SubscriptionMaxTenants,
    IReadOnlyList<string>? EnabledModules,
    IReadOnlyList<ModuleEntitlement>? ModuleEntitlements,
    IReadOnlyDictionary<string, int>? ResolvedLimits);

public sealed record NavigationNodeDto(
    string Id,
    string Label,
    string? Route,
    string? Icon,
    bool Disabled,
    string? DisabledReason,
    bool Placeholder,
    IReadOnlyList<NavigationNodeDto> Children);
