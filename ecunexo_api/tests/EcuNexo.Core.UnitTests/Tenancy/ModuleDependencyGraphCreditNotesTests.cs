using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphCreditNotesTests
{
    [Fact(DisplayName = "CreditNotes depende de Identity e Invoicing en ModuleDependencyGraph")]
    public void CreditNotes_Requires_Identity_And_Invoicing()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.CreditNotes);
        required.Should().HaveCount(2)
            .And.Contain(TenantModuleCodes.Identity)
            .And.Contain(TenantModuleCodes.Invoicing);
    }

    [Fact(DisplayName = "Validar CreditNotes sin Invoicing falla")]
    public void Validate_CreditNotes_WithoutInvoicing_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.CreditNotes]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Notas de Crédito") && e.Contains("Facturación"));
    }

    [Fact(DisplayName = "Validar CreditNotes con Identity e Invoicing pasa")]
    public void Validate_CreditNotes_WithIdentity_And_Invoicing_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([
            TenantModuleCodes.Identity,
            TenantModuleCodes.Catalog,
            TenantModuleCodes.Invoicing,
            TenantModuleCodes.CreditNotes,
        ]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de CreditNotes en todos los tiers")]
    public void ModuleTierCatalog_CreditNotes_Limits_Resolved()
    {
        // Small (20)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CreditNotes, ModuleTier.Small, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(20);

        // Medium (100)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CreditNotes, ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(100);

        // Big (500)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CreditNotes, ModuleTier.Big, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(500);

        // Enterprise (int.MaxValue / ilimitado)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CreditNotes, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(int.MaxValue);

        // Alias "credit_notes"
        ModuleTierCatalog.GetDefaultLimit("credit_notes", ModuleTier.Medium, ModuleTierCatalog.LimitMaxMonthlyCreditNotes)
            .Should().Be(100);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.CreditNotes, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxMonthlyCreditNotes).WhoseValue.Should().Be(20);
    }
}
