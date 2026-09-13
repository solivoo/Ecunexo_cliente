using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphPurchasesTests
{
    [Fact(DisplayName = "Purchases depende de Identity en ModuleDependencyGraph")]
    public void Purchases_Requires_Identity()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Purchases);
        required.Should().HaveCount(1)
            .And.Contain(TenantModuleCodes.Identity);
    }

    [Fact(DisplayName = "Validar Purchases sin Identity falla")]
    public void Validate_Purchases_WithoutIdentity_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Catalog, TenantModuleCodes.Purchases]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Compras") && e.Contains("Identidad"));
    }

    [Fact(DisplayName = "Validar Purchases con Identity pasa sin requerir Catalog")]
    public void Validate_Purchases_WithIdentity_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Purchases]);
        errors.Should().BeEmpty();
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
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMonthlyPurchasesProcessed)
            .Should().Be(50);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(50);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(25);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(50);

        // Medium
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMonthlyPurchasesProcessed)
            .Should().Be(250);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(250);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(100);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(250);

        // Big
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMonthlyPurchasesProcessed)
            .Should().Be(1_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(1_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(500);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(1_000);

        // Enterprise
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMonthlyPurchasesProcessed)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyPurchases)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxSuppliers)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Purchases, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyWithholdings)
            .Should().Be(int.MaxValue);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Purchases, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMonthlyPurchasesProcessed).WhoseValue.Should().Be(50);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyPurchases).WhoseValue.Should().Be(50);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxSuppliers).WhoseValue.Should().Be(25);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyWithholdings).WhoseValue.Should().Be(50);
    }
}
