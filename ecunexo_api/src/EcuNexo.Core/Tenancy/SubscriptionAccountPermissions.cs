namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Permisos de API del titular de licencia (plano suscripción, sin tenant ni RBAC por roles).
/// </summary>
public static class SubscriptionAccountPermissions
{
    public static readonly IReadOnlyList<string> TenancyOperations =
    [
        "tenancy.tenant.read",
        "tenancy.license.apply",
        "tenancy.tenants.read",
        "tenancy.tenants.create",
        "tenancy.tenants.update",
        "tenancy.tenants.delete",
        "platform.settings.read",
        "platform.settings.update",
    ];

    public static readonly IReadOnlyList<string> All = TenancyOperations;

    public static bool IsAllowed(string permissionCode) =>
        TenancyOperations.Contains(permissionCode.Trim().ToLowerInvariant(), StringComparer.Ordinal);
}
