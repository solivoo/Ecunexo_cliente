using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class ModuleDependencyGraphCatalogMatrixTests
{
    [Fact(DisplayName = "CatalogMatrix se canonicia al módulo maestro Catalog")]
    public void CatalogMatrix_Canonicalizes_To_Catalog()
    {
        TenantModuleCodes.Canonicalize("catalog.matrix").Should().Be(TenantModuleCodes.Catalog);
        TenantModuleCodes.Canonicalize("catalog_matrix").Should().Be(TenantModuleCodes.Catalog);
        TenantModuleCodes.Canonicalize("matrix").Should().Be(TenantModuleCodes.Catalog);
    }

    [Fact(DisplayName = "Catalog resuelve límites de variantes y matriz en todos los tiers")]
    public void ModuleTierCatalog_Catalog_Variant_Limits_Resolved()
    {
        // Small (100)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Small, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(100);

        // Medium (1,000)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Medium, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(1000);

        // Big (10,000)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Big, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(10000);

        // Enterprise (int.MaxValue / ilimitado)
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(int.MaxValue);

        // Resolución transparente por alias
        ModuleTierCatalog.GetDefaultLimit("catalog.matrix", ModuleTier.Medium, ModuleTierCatalog.LimitMaxActiveVariants)
            .Should().Be(1000);
        ModuleTierCatalog.GetDefaultLimit("catalog_matrix", ModuleTier.Small, ModuleTierCatalog.LimitMaxVariants)
            .Should().Be(100);

        var defaults = ModuleTierCatalog.GetDefaultsForTier(TenantModuleCodes.Catalog, ModuleTier.Small);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxActiveVariants).WhoseValue.Should().Be(100);
        defaults.Should().ContainKey(ModuleTierCatalog.LimitMaxProductTemplates).WhoseValue.Should().Be(10);

        // Product Templates por tier
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Small, ModuleTierCatalog.LimitMaxProductTemplates).Should().Be(10);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Medium, ModuleTierCatalog.LimitMaxProductTemplates).Should().Be(50);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Big, ModuleTierCatalog.LimitMaxProductTemplates).Should().Be(200);
        ModuleTierCatalog.GetDefaultLimit(TenantModuleCodes.Catalog, ModuleTier.Enterprise, ModuleTierCatalog.LimitMaxProductTemplates).Should().Be(int.MaxValue);
    }
}
