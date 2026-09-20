using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphCreditNotesTests
{
    [Fact(DisplayName = "CreditNotes se canonicia al módulo maestro Invoicing (facturacion)")]
    public void CreditNotes_Canonicalizes_To_Invoicing()
    {
        TenantModuleCodes.Canonicalize(TenantModuleCodes.CreditNotes).Should().Be(TenantModuleCodes.Invoicing);
        TenantModuleCodes.Canonicalize("credit_notes").Should().Be(TenantModuleCodes.Invoicing);
        TenantModuleCodes.Canonicalize("notas_credito").Should().Be(TenantModuleCodes.Invoicing);
    }

    [Fact(DisplayName = "Invoicing requiere Catalog en ModuleDependencyGraph")]
    public void Invoicing_Requires_Catalog()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Invoicing);
        required.Should().HaveCount(1)
            .And.Contain(TenantModuleCodes.Catalog);
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de CreditNotes en todos los tiers")]
    public void ModuleTierCatalog_CreditNotes_Limits_Resolved()
    {
        // Small (20)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Invoicing, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(20);

        // Medium (100)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Invoicing, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(100);

        // Big (500)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Invoicing, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(500);

        // Enterprise (int.MaxValue / ilimitado)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Invoicing, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(int.MaxValue);

        // Alias "credit_notes"
        ModuleTierCatalog.GetDefaultLimit("credit_notes", ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(100);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Invoicing, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyCreditNotes).WhoseValue.Should().Be(20);
    }
}
