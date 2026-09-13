using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphPurchasesTests
{
    [Fact(DisplayName = "Purchases depende de Identity y Catalog en ModuleDependencyGraph")]
    public void Purchases_Requires_Identity_And_Catalog()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Purchases);
        required.Should().HaveCount(2)
            .And.Contain(TenantModuleCodes.Identity)
            .And.Contain(TenantModuleCodes.Catalog);
    }

    [Fact(DisplayName = "Validar Purchases sin Catalog falla")]
    public void Validate_Purchases_WithoutCatalog_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Purchases]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Compras y Proveedores") && e.Contains("Catálogo"));
    }

    [Fact(DisplayName = "Validar Purchases sin Identity falla")]
    public void Validate_Purchases_WithoutIdentity_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Catalog, TenantModuleCodes.Purchases]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Compras y Proveedores") && e.Contains("Identidad"));
    }

    [Fact(DisplayName = "Validar Purchases con Identity y Catalog pasa")]
    public void Validate_Purchases_WithDependencies_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Purchases]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de Purchases en todos los tiers")]
    public void ModuleTierCatalog_Purchases_Limits_Resolved()
    {
        // Small
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(50);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(25);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(50);

        // Medium
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(250);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(100);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(250);

        // Big
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(1_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(500);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(1_000);

        // Enterprise
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(int.MaxValue);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Purchases, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyPurchases).WhoseValue.Should().Be(50);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxSuppliers).WhoseValue.Should().Be(25);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyWithholdings).WhoseValue.Should().Be(50);
    }
}
