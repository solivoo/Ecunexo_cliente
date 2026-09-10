using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.UnitTests.Identity;

public sealed class ModulePermissionFilterTests
{
    [Fact]
    public void IsPermittedForModules_ShouldAllowRepairs_WhenRepairsInEntitlements()
    {
        var enabledModules = new List<string> { "catalog", "warehousing", "inventory", "facturacion", "contabilidad", "training", "support", "repairs", "identity" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "inventory", Tier = ModuleTier.Small },
            new() { ModuleCode = "warehousing", Tier = ModuleTier.Small },
            new() { ModuleCode = "facturacion", Tier = ModuleTier.Small },
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "repairs", Tier = ModuleTier.Small },
            new() { ModuleCode = "training", Tier = ModuleTier.Small },
            new() { ModuleCode = "support", Tier = ModuleTier.Small },
        };

        var permitted = ModulePermissionFilter.IsPermittedForModules(
            "repairs.batches.read",
            enabledModules,
            entitlements);

        permitted.Should().BeTrue();
    }
}
