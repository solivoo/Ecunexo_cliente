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

    [Fact]
    public void IsPermittedForModules_ShouldAllowRemisionGuidesPermissions_WhenRemisionGuidesInLicense()
    {
        var enabledModules = new List<string> { "identity", "catalog", "facturacion", TenantModuleCodes.RemisionGuides };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Big },
            new() { ModuleCode = "facturacion", Tier = ModuleTier.Small },
            new() { ModuleCode = TenantModuleCodes.RemisionGuides, Tier = ModuleTier.Medium },
        };

        ModulePermissionFilter.IsPermittedForModules("facturacion.guias.remision.read", enabledModules, entitlements)
            .Should().BeTrue();
        ModulePermissionFilter.IsPermittedForModules("facturacion.guias.remision.create", enabledModules, entitlements)
            .Should().BeTrue();
    }

    [Fact]
    public void IsPermittedForModules_ShouldAllowCreditNotesPermissions_WhenFacturacionInEntitlements()
    {
        var enabledModules = new List<string> { "identity", "catalog", "facturacion" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Big },
            new() { ModuleCode = "facturacion", Tier = ModuleTier.Small },
        };

        ModulePermissionFilter.IsPermittedForModules("facturacion.notas.credito.read", enabledModules, entitlements)
            .Should().BeTrue();
        ModulePermissionFilter.IsPermittedForModules("facturacion.notas.credito.create", enabledModules, entitlements)
            .Should().BeTrue();
        ModulePermissionFilter.IsPermittedForModules("facturacion.notascredito.read", enabledModules, entitlements)
            .Should().BeTrue();
    }

    [Fact]
    public void IsPermittedForModules_ShouldBlockCreditNotesPermissions_WhenFacturacionNotInLicense()
    {
        var enabledModules = new List<string> { "identity", "catalog" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Big },
        };

        ModulePermissionFilter.IsPermittedForModules("facturacion.notas.credito.read", enabledModules, entitlements)
            .Should().BeFalse();
        ModulePermissionFilter.IsPermittedForModules("facturacion.notas.credito.create", enabledModules, entitlements)
            .Should().BeFalse();
    }

    [Fact]
    public void FilterPermissionCodes_ShouldDynamicallyIncludeAndExcludePermissions_WhenGrantingAndRevoking()
    {
        string[] allPermissions =
        [
            "facturacion.facturas.read",
            "facturacion.facturas.create",
            "facturacion.notas.credito.read",
            "facturacion.notas.credito.create",
            "purchases.documents.read",
            "purchases.documents.manage",
        ];

        // Scenario 1: Facturación enabled, Purchases disabled
        var modulesFacturacion = new List<string> { "identity", "facturacion" };
        var filteredFacturacion = ModulePermissionFilter.FilterPermissionCodes(allPermissions, modulesFacturacion);

        filteredFacturacion.Should().Contain(["facturacion.facturas.read", "facturacion.facturas.create", "facturacion.notas.credito.read", "facturacion.notas.credito.create"]);
        filteredFacturacion.Should().NotContain(["purchases.documents.read", "purchases.documents.manage"]);

        // Scenario 2: Add Purchases module
        var modulesBoth = new List<string> { "identity", "facturacion", "purchases" };
        var filteredBoth = ModulePermissionFilter.FilterPermissionCodes(allPermissions, modulesBoth);

        filteredBoth.Should().HaveCount(6);
        filteredBoth.Should().Contain("purchases.documents.read");

        // Scenario 3: Revoke Facturación module (only Purchases remains)
        var modulesPurchasesOnly = new List<string> { "identity", "purchases" };
        var filteredPurchases = ModulePermissionFilter.FilterPermissionCodes(allPermissions, modulesPurchasesOnly);

        filteredPurchases.Should().NotContain(["facturacion.facturas.read", "facturacion.notas.credito.read"]);
        filteredPurchases.Should().Contain(["purchases.documents.read", "purchases.documents.manage"]);
    }

    [Fact]
    public void PermissionModuleMapper_ShouldResolveToRootModules_ForCatalogMatrixAndInvoicingExtensions()
    {
        PermissionModuleMapper.ResolveProductModule("catalog.matrix.read").Should().Be(TenantModuleCodes.Catalog);
        PermissionModuleMapper.ResolveProductModule("catalog.matrix.create").Should().Be(TenantModuleCodes.Catalog);
        PermissionModuleMapper.ResolveProductModule("catalog.matrix.update").Should().Be(TenantModuleCodes.Catalog);
        PermissionModuleMapper.ResolveProductModule("catalog.matrix.delete").Should().Be(TenantModuleCodes.Catalog);
        PermissionModuleMapper.ResolveProductModule("catalog.scale.manage").Should().Be(TenantModuleCodes.Catalog);

        PermissionModuleMapper.ResolveProductModule("facturacion.notas.credito.read").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.notas.credito.create").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.notas.credito.anular").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.guias.remision.read").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.guias.remision.create").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.guias.remision.autorizar").Should().Be(TenantModuleCodes.Invoicing);
        PermissionModuleMapper.ResolveProductModule("facturacion.transportistas.manage").Should().Be(TenantModuleCodes.Invoicing);
    }

    [Fact]
    public void IsPermittedForModules_ShouldAllowCatalogMatrixPermissions_WhenCatalogInEntitlements()
    {
        var enabledModules = new List<string> { "identity", "catalog" };
        var entitlements = new List<ModuleEntitlement>
        {
            new() { ModuleCode = "identity", Tier = ModuleTier.Small },
            new() { ModuleCode = "catalog", Tier = ModuleTier.Medium },
        };

        string[] matrixPermissions =
        [
            "catalog.matrix.read",
            "catalog.matrix.create",
            "catalog.matrix.update",
            "catalog.matrix.delete",
            "catalog.scale.manage",
        ];

        foreach (var perm in matrixPermissions)
        {
            ModulePermissionFilter.IsPermittedForModules(perm, enabledModules, entitlements)
                .Should().BeTrue($"permission {perm} should be permitted when catalog is enabled");
        }
    }
}

