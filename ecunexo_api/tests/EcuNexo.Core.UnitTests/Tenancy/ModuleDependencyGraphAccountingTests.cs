using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphAccountingTests
{
    [Fact(DisplayName = "Accounting depende de Identity en ModuleDependencyGraph")]
    public void Accounting_Requires_Identity()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Accounting);
        required.Should().HaveCount(1)
            .And.Contain(TenantModuleCodes.Identity);
    }

    [Fact(DisplayName = "Validar Accounting sin Identity falla")]
    public void Validate_Accounting_WithoutIdentity_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Catalog, TenantModuleCodes.Accounting]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Contabilidad") && e.Contains("Identidad"));
    }

    [Fact(DisplayName = "Validar Accounting con Identity pasa")]
    public void Validate_Accounting_WithIdentity_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Accounting]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de Accounting en todos los tiers")]
    public void ModuleTierCatalog_Accounting_Limits_Resolved()
    {
        // Small
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Small, ModuleTierCatalog.LimitMaxChartAccounts)
            .Should().Be(100);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyJournalEntries)
            .Should().Be(200);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Small, ModuleTierCatalog.LimitAllowCustomSubaccounts)
            .Should().Be(1);

        // Medium
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Medium, ModuleTierCatalog.LimitMaxChartAccounts)
            .Should().Be(500);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyJournalEntries)
            .Should().Be(1_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Medium, ModuleTierCatalog.LimitAllowCustomSubaccounts)
            .Should().Be(1);

        // Big
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Big, ModuleTierCatalog.LimitMaxChartAccounts)
            .Should().Be(2_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyJournalEntries)
            .Should().Be(5_000);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Big, ModuleTierCatalog.LimitAllowCustomSubaccounts)
            .Should().Be(1);

        // Enterprise
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxChartAccounts)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyJournalEntries)
            .Should().Be(int.MaxValue);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Accounting, ModuleTier.Enterprise, ModuleTierCatalog.LimitAllowCustomSubaccounts)
            .Should().Be(1);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Accounting, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxChartAccounts).WhoseValue.Should().Be(100);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyJournalEntries).WhoseValue.Should().Be(200);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitAllowCustomSubaccounts).WhoseValue.Should().Be(1);
    }
}
