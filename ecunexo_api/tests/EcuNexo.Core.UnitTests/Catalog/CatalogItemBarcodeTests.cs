using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.UnitTests.Catalog;

/// <summary>Código de barras del ítem: identificador de escaneo, no atributo de plantilla.</summary>
public sealed class CatalogItemBarcodeTests
{
    private static Result<CatalogItem> Create(string? barcode) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Producto de prueba",
            description: null,
            sku: "SKU-001",
            basePrice: 10m,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson,
            barcode: barcode);

    [Fact(DisplayName = "Crear ítem normaliza el código de barras")]
    public void Create_NormalizesBarcode()
    {
        var result = Create(" 7501234567890 ");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Barcode.Should().Be("7501234567890");
    }

    [Fact(DisplayName = "Crear ítem sin código de barras lo deja nulo")]
    public void Create_WithoutBarcode_IsNull()
    {
        var result = Create("   ");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Barcode.Should().BeNull();
    }

    [Fact(DisplayName = "Código de barras demasiado largo falla con validación")]
    public void Create_WithTooLongBarcode_Fails()
    {
        var result = Create(new string('9', CatalogItem.BarcodeMaxLength + 1));

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.barcode.length");
    }

    [Fact(DisplayName = "SetBarcode actualiza y limpia el código")]
    public void SetBarcode_UpdatesAndClears()
    {
        var item = Create(null).Value!;

        item.SetBarcode(" abc-123 ").IsSuccess.Should().BeTrue();
        item.Barcode.Should().Be("ABC-123");

        item.SetBarcode(" ").IsSuccess.Should().BeTrue();
        item.Barcode.Should().BeNull();
    }

    [Fact(DisplayName = "La variante hija persiste su propio código de barras")]
    public void CreateVariantChild_PersistsBarcode()
    {
        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Camiseta",
            description: null,
            modelCode: "CAM-001",
            basePrice: 20m,
            variantDimensionsJson: """[{"name":"Talla","values":["S","M"]}]""",
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Talla S",
            "CAM-001-S",
            basePrice: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson,
            barcode: " 7509999999999 ").Value!;

        child.Barcode.Should().Be("7509999999999");
    }
}
