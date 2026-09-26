using EcuNexo.Business.Platform.Navigation;
using EcuNexo.Business.Platform.Queries.GetSession;
using EcuNexo.Core.Platform.Navigation;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.UnitTests.Platform;

public sealed class MenuNavigationMapperTests
{
    [Fact(DisplayName = "Un módulo no contratado queda visible y bloqueado en el menú")]
    public void BuildTree_ModuleNotEntitled_KeepsLeafVisibleLocked()
    {
        var items = new[]
        {
            Item("catalog", null, "Catálogo", route: null, TenantModuleCodes.Catalog),
            Item("catalog-items", "catalog", "Ítems", "catalogo/items", TenantModuleCodes.Catalog),
        };

        var tree = MenuNavigationMapper.BuildTree(items, [], [TenantModuleCodes.Identity]);

        var section = tree.Should().ContainSingle().Subject;
        section.Id.Should().Be("catalog");
        section.Disabled.Should().BeFalse();

        var leaf = section.Children.Should().ContainSingle().Subject;
        leaf.Id.Should().Be("catalog-items");
        leaf.Disabled.Should().BeTrue();
        leaf.LockKind.Should().Be("module");
        leaf.RequiredModule.Should().Be(TenantModuleCodes.Catalog);
        leaf.DisabledReason.Should().Contain("plan");
    }

    [Fact(DisplayName = "Un módulo contratado no se bloquea y los legacy sin lista ven todo")]
    public void BuildTree_EntitledOrLegacy_ShowsItems()
    {
        var items = new[]
        {
            Item("catalog-items", null, "Ítems", "catalogo/items", TenantModuleCodes.Catalog),
        };

        var entitled = MenuNavigationMapper.BuildTree(items, [], [TenantModuleCodes.Catalog]);
        var legacy = MenuNavigationMapper.BuildTree(items, [], null);

        entitled.Should().ContainSingle().Which.Disabled.Should().BeFalse();
        legacy.Should().ContainSingle().Which.Disabled.Should().BeFalse();
    }

    [Fact(DisplayName = "Un bloqueo por permiso interno oculta la hoja")]
    public void BuildTree_MissingPermission_HidesLeaf()
    {
        var items = new[]
        {
            Item(
                "team-users",
                null,
                "Usuarios",
                "equipo/usuarios",
                TenantModuleCodes.Identity,
                permissions: ["identity.users.read"]),
        };

        var tree = MenuNavigationMapper.BuildTree(items, [], [TenantModuleCodes.Identity]);

        tree.Should().BeEmpty();
    }

    [Fact(DisplayName = "Un contenedor con permiso propio no oculta a sus hijos accesibles")]
    public void BuildTree_ContainerWithVisibleChildren_StaysAccessible()
    {
        var items = new[]
        {
            Item(
                "catalog",
                null,
                "Catálogo",
                route: null,
                TenantModuleCodes.Catalog,
                permissions: ["catalog.item.read"]),
            Item("catalog-items", "catalog", "Ítems", "catalogo/items", TenantModuleCodes.Catalog),
        };

        var tree = MenuNavigationMapper.BuildTree(items, [], [TenantModuleCodes.Catalog]);

        var section = tree.Should().ContainSingle().Subject;
        section.Disabled.Should().BeFalse();
        section.Children.Should().ContainSingle();
    }

    [Fact(DisplayName = "Un placeholder se muestra como próximamente")]
    public void BuildTree_Placeholder_IsVisible()
    {
        var items = new[]
        {
            Item("soon", null, "Pronto", "futuro", TenantModuleCodes.Catalog, placeholder: true),
        };

        var tree = MenuNavigationMapper.BuildTree(items, [], [TenantModuleCodes.Catalog]);

        var node = tree.Should().ContainSingle().Subject;
        node.Placeholder.Should().BeTrue();
        node.LockKind.Should().Be("placeholder");
    }

    [Fact(DisplayName = "Los entitlements mandan sobre la lista legacy de módulos")]
    public void ResolveEnabledModules_EntitlementsWinOverLegacy()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Demo",
            new ServicePlan("Medium", 10, 2),
            moduleEntitlements:
            [
                ModuleEntitlement.FromTier(TenantModuleCodes.Identity, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Medium),
            ]).Value!;

        var modules = GetSessionHandler.ResolveEnabledModules(tenant);

        modules.Should().NotBeNull();
        modules!.Should().BeEquivalentTo([TenantModuleCodes.Identity, TenantModuleCodes.Catalog]);
    }

    [Fact(DisplayName = "Sin entitlements se usa la lista legacy; sin ninguna, todo habilitado")]
    public void ResolveEnabledModules_FallsBackToLegacy()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Demo",
            new ServicePlan("Medium", 10, 2)).Value!;

        GetSessionHandler.ResolveEnabledModules(tenant).Should().BeNull();
    }

    private static MenuItem Item(
        string id,
        string? parentId,
        string label,
        string? route,
        string moduleCode,
        string[]? permissions = null,
        bool placeholder = false) =>
        new()
        {
            Id = id,
            ParentId = parentId,
            Label = label,
            Route = route,
            ModuleCode = moduleCode,
            RequiredPermissions = permissions ?? [],
            IsPlaceholder = placeholder,
            Context = MenuContextKind.Operational,
            IsActive = true,
        };
}
