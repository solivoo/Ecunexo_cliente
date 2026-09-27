using System.Text.Json;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Catalog.ValueObjects;

namespace EcuNexo.Core.UnitTests.Catalog;

/// <summary>
/// Propagación de renombrados de atributos del diccionario hacia los ítems del catálogo.
/// </summary>
public sealed class CatalogItemAttributeRenameTests
{
    private static CatalogItem CreateItemWithAttributes(string attributesJson) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Producto de prueba",
            description: null,
            sku: "TST-001",
            basePrice: 10m,
            customAttributesJson: attributesJson,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

    [Fact(DisplayName = "Renombrar clave actualiza ficha y ruta jerárquica")]
    public void RenameAttributeKey_UpdatesAttributesAndHierarchyPath()
    {
        var item = CatalogItem.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Producto de prueba",
            description: null,
            sku: "TST-002",
            basePrice: 10m,
            customAttributesJson: """{"colección":"Halloween","material":"Algodón"}""",
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson,
            hierarchyPathJson: """[{"level":"Línea","name":"Colección","value":"Halloween"}]""").Value!;

        var changed = item.RenameAttributeKey("Colección", "Línea / Colección");

        changed.Should().BeTrue();
        using var attributes = JsonDocument.Parse(item.CustomAttributesJson);
        attributes.RootElement.TryGetProperty("Línea / Colección", out var value).Should().BeTrue();
        value.GetString().Should().Be("Halloween");
        attributes.RootElement.TryGetProperty("colección", out _).Should().BeFalse();

        using var path = JsonDocument.Parse(item.HierarchyPathJson!);
        path.RootElement[0].GetProperty("name").GetString().Should().Be("Línea / Colección");
        path.RootElement[0].GetProperty("value").GetString().Should().Be("Halloween");
    }

    [Fact(DisplayName = "Renombrar clave actualiza el nombre de la dimensión de la matriz")]
    public void RenameAttributeKey_UpdatesMatrixDimensionName()
    {
        var item = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Camiseta",
            description: null,
            modelCode: "CAM-001",
            basePrice: 20m,
            variantDimensionsJson: """[{"name":"Talla","values":["S","M"],"type":"size"}]""",
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var changed = item.RenameAttributeKey("Talla", "Talla Kids");

        changed.Should().BeTrue();
        using var dimensions = JsonDocument.Parse(item.VariantDimensionsJson!);
        dimensions.RootElement[0].GetProperty("name").GetString().Should().Be("Talla Kids");
        dimensions.RootElement[0].GetProperty("values").GetArrayLength().Should().Be(2);
    }

    [Fact(DisplayName = "Renombrar valor actualiza ficha, dimensiones, ruta y grupos de fotos")]
    public void RenameAttributeValue_PropagatesEverywhere()
    {
        var tenantId = Guid.CreateVersion7();
        var item = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Camiseta",
            description: null,
            modelCode: "CAM-002",
            basePrice: 20m,
            variantDimensionsJson: """[{"name":"Talla","values":["S","M"]}]""",
            customAttributesJson: """{"talla":"M"}""",
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson,
            hierarchyPathJson: """[{"level":"Nivel","name":"Talla","value":"M"}]""").Value!;

        var imageResult = item.AddImage(
            Guid.CreateVersion7(),
            "catalog/tenant/cam-002.png",
            "cam-002.png",
            altText: null,
            new ImageDimensions(1200, 1200),
            fileSizeBytes: 1024,
            thumbUrl: "https://cdn/t.png",
            mediumUrl: "https://cdn/m.png",
            largeUrl: "https://cdn/l.png",
            groupValue: "M");
        imageResult.IsSuccess.Should().BeTrue(because: imageResult.Error?.Message);

        var changed = item.RenameAttributeValue("Talla", "M", "Mediano", renameImageGroups: true);

        changed.Should().BeTrue();
        using var attributes = JsonDocument.Parse(item.CustomAttributesJson);
        attributes.RootElement.GetProperty("talla").GetString().Should().Be("Mediano");

        using var dimensions = JsonDocument.Parse(item.VariantDimensionsJson!);
        dimensions.RootElement[0].GetProperty("values")[1].GetString().Should().Be("Mediano");

        using var path = JsonDocument.Parse(item.HierarchyPathJson!);
        path.RootElement[0].GetProperty("value").GetString().Should().Be("Mediano");

        item.Images.Single().GroupValue.Should().Be("Mediano");
    }

    [Fact(DisplayName = "Renombrar valor en selección múltiple respeta el resto de etiquetas")]
    public void RenameAttributeValue_MultiValue_KeepsOtherTokens()
    {
        var item = CreateItemWithAttributes("""{"actividad / uso":"Running, Casual"}""");

        var changed = item.RenameAttributeValue(
            "Actividad / Uso",
            "Casual",
            "Casual Urbano",
            isMultiValue: true);

        changed.Should().BeTrue();
        using var attributes = JsonDocument.Parse(item.CustomAttributesJson);
        attributes.RootElement.GetProperty("actividad / uso").GetString().Should().Be("Running, Casual Urbano");
    }

    [Fact(DisplayName = "Renombrar valor en arreglo reemplaza solo la coincidencia exacta")]
    public void RenameAttributeValue_Array_ReplacesMatchingElement()
    {
        var item = CreateItemWithAttributes("""{"actividad / uso":["Running","Casual"]}""");

        var changed = item.RenameAttributeValue("Actividad / Uso", "casual", "Casual Urbano");

        changed.Should().BeTrue();
        using var attributes = JsonDocument.Parse(item.CustomAttributesJson);
        var values = attributes.RootElement.GetProperty("actividad / uso");
        values[0].GetString().Should().Be("Running");
        values[1].GetString().Should().Be("Casual Urbano");
    }

    [Fact(DisplayName = "Sin coincidencias no modifica el ítem")]
    public void RenameAttribute_WhenNoMatch_ReturnsFalseAndKeepsJson()
    {
        var item = CreateItemWithAttributes("""{"material":"Algodón"}""");
        var originalAttributes = item.CustomAttributesJson;

        item.RenameAttributeKey("Colección", "Línea").Should().BeFalse();
        item.RenameAttributeValue("Colección", "Halloween", "Invierno").Should().BeFalse();
        item.CustomAttributesJson.Should().Be(originalAttributes);
    }
}
