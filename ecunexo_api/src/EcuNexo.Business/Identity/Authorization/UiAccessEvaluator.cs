namespace EcuNexo.Business.Identity.Authorization;

/// <summary>
/// Mapa estático MVP de acciones UI por permiso; evolucionar a metadatos en políticas Allow.
/// </summary>
public sealed class UiAccessEvaluator : IUiAccessEvaluator
{
    private static readonly Dictionary<string, string[]> ActionsByPermission = new(StringComparer.OrdinalIgnoreCase)
        {
            ["identity.users.read"] = ["view"],
            ["identity.users.create"] = ["create"],
            ["identity.users.update"] = ["edit", "disable"],
            ["identity.users.delete"] = ["delete"],
            ["identity.roles.read"] = ["view"],
            ["identity.roles.manage"] = ["create", "assign_permission", "assign_user"],
            ["identity.permissions.read"] = ["view"],
            ["identity.permissions.manage"] = ["create"],
            ["identity.policies.manage"] = ["create_policy"],
            ["tenancy.tenant.read"] = ["view_branding", "view_plan"],
            ["tenancy.license.apply"] = ["apply_license"],
            ["tenancy.tenants.read"] = ["view_companies"],
            ["tenancy.tenants.create"] = ["create_company"],
            ["tenancy.tenants.update"] = ["edit_company"],
            ["tenancy.tenants.delete"] = ["delete_company"],
            ["catalog.item.read"] = ["view"],
            ["catalog.item.create"] = ["create"],
            ["catalog.item.update"] = ["edit"],
            ["catalog.item.delete"] = ["delete"],
            ["catalog.category.manage"] = ["create", "edit", "delete"],
            ["warehousing.read"] = ["view"],
            ["warehousing.locations.manage"] = ["create", "edit"],
            ["inventory.stock.read"] = ["view"],
            ["inventory.stock.manage"] = ["edit"],
            ["inventory.documents.create"] = ["create"],
            ["inventory.documents.approve"] = ["approve"],
            ["inventory.movement.read"] = ["view"],
        };

    public IReadOnlyList<string> GetAllowedActions(string permissionCode, bool granted)
    {
        if (!granted)
        {
            return [];
        }

        var normalized = permissionCode.Trim().ToLowerInvariant();
        return ActionsByPermission.TryGetValue(normalized, out var actions)
            ? actions
            : ["view"];
    }
}
