using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphRepairsTests
{
    [Fact(DisplayName = "Repairs depende de Identity en ModuleDependencyGraph")]
    public void Repairs_Requires_Identity()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Repairs);
        required.Should().ContainSingle().Which.Should().Be(TenantModuleCodes.Identity);
    }

    [Fact(DisplayName = "Validar Repairs sin Identity falla")]
    public void Validate_Repairs_WithoutIdentity_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Repairs]);
        errors.Should().NotBeEmpty();
        errors[0].Should().Contain("Taller y Reparaciones B2B").And.Contain("Identidad");
    }

    [Fact(DisplayName = "Validar Repairs con Identity pasa")]
    public void Validate_Repairs_WithIdentity_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Repairs]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de Repairs")]
    public void ModuleTierCatalog_Repairs_Limits_Resolved()
    {
        var activeBatches = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Repairs,
            ModuleTier.Medium,
            ModuleTierCatalog.LimitMaxActiveBatches);
        activeBatches.Should().Be(50);

        var equipmentsPerBatch = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Repairs,
            ModuleTier.Medium,
            ModuleTierCatalog.LimitMaxEquipmentsPerBatch);
        equipmentsPerBatch.Should().Be(500);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Repairs, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxActiveBatches).WhoseValue.Should().Be(10);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxEquipmentsPerBatch).WhoseValue.Should().Be(100);
    }
}
