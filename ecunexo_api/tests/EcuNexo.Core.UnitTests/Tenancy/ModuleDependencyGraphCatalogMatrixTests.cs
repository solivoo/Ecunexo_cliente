using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphCatalogMatrixTests
{
    [Fact(DisplayName = "CatalogMatrix depende de Identity y Catalog en ModuleDependencyGraph")]
    public void CatalogMatrix_Requires_Identity_And_Catalog()
    {
        var required = ModuleDependencyGraph.GetRequiredModules(TenantModuleCodes.CatalogMatrix);
        required.Should().HaveCount(2)
            .And.Contain(TenantModuleCodes.Identity)
            .And.Contain(TenantModuleCodes.Catalog);
    }

    [Fact(DisplayName = "Validar CatalogMatrix sin Catalog falla")]
    public void Validate_CatalogMatrix_WithoutCatalog_Fails()
    {
        var errors = ModuleDependencyGraph.Validate([TenantModuleCodes.Identity, TenantModuleCodes.CatalogMatrix]);
        errors.Should().NotBeEmpty();
        errors.Should().Contain(e => e.Contains("Matriz de Tallas, Colores y Variantes") && e.Contains("Catálogo"));
    }

    [Fact(DisplayName = "Validar CatalogMatrix con Identity y Catalog pasa")]
    public void Validate_CatalogMatrix_WithIdentity_And_Catalog_Passes()
    {
        var errors = ModuleDependencyGraph.Validate([
            TenantModuleCodes.Identity,
            TenantModuleCodes.Catalog,
            TenantModuleCodes.CatalogMatrix,
        ]);
        errors.Should().BeEmpty();
    }

    [Fact(DisplayName = "ModuleTierCatalog resuelve límites de CatalogMatrix en todos los tiers")]
    public void ModuleTierCatalog_CatalogMatrix_Limits_Resolved()
    {
        // Small (100)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CatalogMatrix, ModuleTier.Small, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(100);

        // Medium (1,000)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CatalogMatrix, ModuleTier.Medium, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(1000);

        // Big (10,000)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CatalogMatrix, ModuleTier.Big, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(10000);

        // Enterprise (int.MaxValue / ilimitado)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CatalogMatrix, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(int.MaxValue);

        // Alias "catalog_matrix" y "catalog.matrix"
        ModuleTierCatalog.GetDefaultLimit("catalog_matrix", ModuleTier.Medium, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(1000);
        ModuleTierCatalog.GetDefaultLimit("catalog.matrix", ModuleTier.Medium, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(1000);

        // Soporte de clave alternativa LimitMaxVariants
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.CatalogMatrix, ModuleTier.Small, ModuleTierCatalog.LimitMaxVariants)
            .Should().Be(100);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.CatalogMatrix, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxActiveVariants).WhoseValue.Should().Be(100);
    }
}
