using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.UnitTests.Support;

/// <summary>Fábricas mínimas compartidas por tests de Business.</summary>
internal static class CatalogTestFactory
{
    public static CatalogItem Physical(Guid? id = null, string name = "Tornillo M6", string sku = "TOR-M6")
    {
        var created = CatalogItem.Create(
            id ?? Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            name,
            description: null,
            sku,
            basePrice: 1.5m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }
}
