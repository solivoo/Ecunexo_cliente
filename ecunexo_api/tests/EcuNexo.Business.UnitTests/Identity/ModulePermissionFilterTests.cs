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

    [Fact]
    public void IsPermittedForModules_ShouldAllowPurchasesPermissions_WhenPurchasesInEntitlements()
    {
        var enabledModules = new List<string> { "identity", "catalog", "purchases" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Big },
            new() { ModuleCode = "purchases", Tier = ModuleTier.Small },
        };

        string[] purchasesPermissions =
        [
            "purchases.documents.read",
            "purchases.documents.manage",
            "purchases.suppliers.read",
            "purchases.suppliers.manage",
            "purchases.proformas.read",
            "purchases.proformas.manage",
            "purchases.proformas.approve",
            "purchases.expenses.read",
            "purchases.expenses.manage",
            "purchases.withholdings.read",
            "purchases.withholdings.issue",
        ];

        foreach (var perm in purchasesPermissions)
        {
            ModulePermissionFilter.IsPermittedForModules(perm, enabledModules, entitlements)
                .Should().BeTrue($"permission {perm} should be permitted when purchases is enabled");
        }
    }

    [Fact]
    public void IsPermittedForModules_ShouldBlockPurchasesPermissions_WhenPurchasesNotInLicense()
    {
        var enabledModules = new List<string> { "identity", "catalog", "invoicing" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Big },
            new() { ModuleCode = "invoicing", Tier = ModuleTier.Small },
        };

        ModulePermissionFilter.IsPermittedForModules("purchases.documents.read", enabledModules, entitlements)
            .Should().BeFalse();
        ModulePermissionFilter.IsPermittedForModules("purchases.withholdings.issue", enabledModules, entitlements)
            .Should().BeFalse();
    }
}
