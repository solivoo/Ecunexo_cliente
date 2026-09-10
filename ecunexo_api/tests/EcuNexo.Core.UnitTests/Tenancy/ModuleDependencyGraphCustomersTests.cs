using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphCustomersTests
{
    [Fact(DisplayName = "Customers depende de Identity en ModuleDependencyGraph")]
    public void Customers_Requires_Identity()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.Customers);
        required.Should().ContainSingle().Which.Should().Be(TenantModuleCodes.Identity);
    }

    [Fact(DisplayName = "Validar Customers sin Identity falla")]
    public void Validate_Customers_WithoutIdentity_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Customers]);
        errors.Should().NotBeEmpty();
        errors[0].Should().Contain("Clientes").And.Contain("Identidad");
    }

    [Fact(DisplayName = "Validar Customers con Identity pasa")]
    public void Validate_Customers_WithIdentity_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.Customers]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de Customers correctamente")]
    public void ModuleTierCatalog_Customers_Limits_Resolved()
    {
        var smallLimit = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Customers,
            ModuleTier.Small,
            ModuleTierCatalog.LimitMaxCustomers);
        smallLimit.Should().Be(100);

        var mediumLimit = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Customers,
            ModuleTier.Medium,
            ModuleTierCatalog.LimitMaxCustomers);
        mediumLimit.Should().Be(1_000);

        var bigLimit = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Customers,
            ModuleTier.Big,
            ModuleTierCatalog.LimitMaxCustomers);
        bigLimit.Should().Be(10_000);

        var enterpriseLimit = ModuleTierCatalog.GetDefaultLimit(
            TenantModuleCodes.Customers,
            ModuleTier.Enterprise,
            ModuleTierCatalog.LimitMaxCustomers);
        enterpriseLimit.Should().Be(int.MaxValue);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Customers, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxCustomers).WhoseValue.Should().Be(100);
    }
}
