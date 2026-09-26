using EcuNexo.Core.Catalog;

namespace EcuNexo.Core.UnitTests.Support;

/// <summary>Fábricas mínimas para armar agregados en tests de dominio.</summary>
internal static class CatalogTestFactory
{
    public static CatalogItem Physical(Guid? id = null, Guid? tenantId = null, string name = "Tornillo M6", string sku = "TOR-M6")
    {
        var created = CatalogItem.Create(
            id ?? Guid.CreateVersion7(),
            tenantId ?? Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            name,
            description: null,
            sku,
            basePrice: 1.5m,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }

    public static CatalogItem Service(Guid? id = null, string name = "Instalación")
    {
        var created = CatalogItem.Create(
            id ?? Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Service,
            name,
            description: null,
            sku: null,
            basePrice: 25m,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }

    public static CatalogItem MatrixParent(
        Guid? id = null,
        Guid? tenantId = null,
        CatalogItemKind kind = CatalogItemKind.Physical,
        string name = "Camiseta Deportiva",
        string sku = "CAM-DEP")
    {
        var tid = tenantId ?? Guid.CreateVersion7();
        var created = CatalogItem.CreateMatrixParent(
            id ?? Guid.CreateVersion7(),
            tid,
            kind,
            name,
            description: null,
            modelCode: sku,
            basePrice: 20m,
            variantDimensionsJson: """[{"name":"Talla","values":["S","M","L"]}]""",
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }

    public static CatalogItem VariantChild(
        CatalogItem parent,
        Guid? id = null,
        string variantTitle = "Talla M",
        string sku = "CAM-DEP-M",
        decimal? basePrice = null)
    {
        var created = CatalogItem.CreateVariantChild(
            id ?? Guid.CreateVersion7(),
            parent,
            variantTitle,
            sku,
            basePrice ?? parent.BasePrice,
            customAttributesJson: """{"talla":"M"}""",
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }
}
