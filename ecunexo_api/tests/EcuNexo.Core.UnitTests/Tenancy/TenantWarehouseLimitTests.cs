using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class TenantWarehouseLimitTests
{
    [Fact(DisplayName = "Cupo 1 bodega no admite red de sucursales")]
    public void AllowsMultipleWarehouses_MaxOne_IsFalse()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Una sola",
            new ServicePlan("Starter", 5, 1)).Value!;

        tenant.ResolveMaxWarehouses().Should().Be(1);
        tenant.AllowsMultipleWarehouses().Should().BeFalse();
    }

    [Fact(DisplayName = "Cupo mayor a 1 admite Principal y tránsito")]
    public void AllowsMultipleWarehouses_MaxFive_IsTrue()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Varias",
            new ServicePlan("Business", 10, 5)).Value!;

        tenant.ResolveMaxWarehouses().Should().Be(5);
        tenant.AllowsMultipleWarehouses().Should().BeTrue();
    }

    [Fact(DisplayName = "El cupo del plan no lo recorta el tier Small de warehousing")]
    public void AllowsMultipleWarehouses_PlanTwo_SmallEntitlement_UsesPlan()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Taller",
            new ServicePlan("Taller", 5, 2),
            enabledModuleCodes:
            [
                TenantModuleCodes.Identity,
                TenantModuleCodes.Catalog,
                TenantModuleCodes.Warehousing,
                TenantModuleCodes.Inventory,
                TenantModuleCodes.Invoicing,
            ],
            moduleEntitlements: ModuleTierCatalog.FromModuleCodesWithTier(
            [
                TenantModuleCodes.Identity,
                TenantModuleCodes.Catalog,
                TenantModuleCodes.Warehousing,
                TenantModuleCodes.Inventory,
                TenantModuleCodes.Invoicing,
            ])).Value!;

        tenant.ResolveMaxWarehouses().Should().Be(2);
        tenant.AllowsMultipleWarehouses().Should().BeTrue();
    }
}
