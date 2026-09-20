using EcuNexo.Core.Catalog;

namespace EcuNexo.Core.UnitTests.Catalog;

public sealed class ProductMatrixItemTests
{
    [Fact(DisplayName = "Crear producto matriz con dimensiones válidas tiene éxito")]
    public void CreateMatrixParent_WithValidDimensions_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var id = Guid.CreateVersion7();
        var dimensionsJson = "[{\"name\": \"Talla\", \"values\": [\"35-38\", \"39-41\", \"42-44\"]}]";

        var result = CatalogItem.CreateMatrixParent(
            id,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Deportivo Térmico",
            "Calcetines de algodón para deporte",
            modelCode: "CALC-DEP",
            basePrice: 3.50m,
            categoryId: null,
            variantDimensionsJson: dimensionsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        result.IsSuccess.Should().BeTrue();
        var item = result.Value!;
        item.IsMatrixParent.Should().BeTrue();
        item.ParentId.Should().BeNull();
        item.Sku.Should().Be("CALC-DEP");
        item.VariantDimensionsJson.Should().Contain("Talla");
        item.Variants.Should().BeEmpty();
    }

    [Fact(DisplayName = "Crear producto matriz físico sin SKU/código de modelo sigue siendo válido")]
    public void CreateMatrixParent_WithoutSku_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var id = Guid.CreateVersion7();
        var dimensionsJson = "[{\"name\": \"Talla\", \"values\": [\"S\", \"M\", \"L\"]}]";

        var result = CatalogItem.CreateMatrixParent(
            id,
            tenantId,
            CatalogItemKind.Physical,
            "Camiseta Básica",
            description: null,
            modelCode: null,
            basePrice: 12.00m,
            categoryId: null,
            variantDimensionsJson: dimensionsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Sku.Should().BeNull();
        result.Value!.IsMatrixParent.Should().BeTrue();
    }

    [Fact(DisplayName = "Crear variante hija vinculada al producto matriz hereda datos y requiere SKU")]
    public void CreateVariantChild_LinkedToParent_SucceedsAndEnforcesSku()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();
        var dimensionsJson = "[{\"name\": \"Talla\", \"values\": [\"35-38\", \"39-41\"]}]";

        var parentResult = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Deportivo",
            "Descripción compartida",
            modelCode: "CALC-01",
            basePrice: 3.50m,
            categoryId: null,
            variantDimensionsJson: dimensionsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        parentResult.IsSuccess.Should().BeTrue();
        var parent = parentResult.Value!;

        var childId = Guid.CreateVersion7();
        var childResult = CatalogItem.CreateVariantChild(
            childId,
            parent,
            variantTitle: "35-38",
            sku: "CALC-01-3538",
            basePrice: null, // hereda 3.50
            customAttributesJson: "{\"talla\": \"35-38\"}",
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        childResult.IsSuccess.Should().BeTrue();
        var child = childResult.Value!;
        child.ParentId.Should().Be(parent.Id);
        child.IsMatrixParent.Should().BeFalse();
        child.Name.Should().Be("Calcetín Deportivo - 35-38");
        child.Sku.Should().Be("CALC-01-3538");
        child.BasePrice.Should().Be(3.50m);
        child.Kind.Should().Be(CatalogItemKind.Physical);

        parent.AddVariantChild(child).IsSuccess.Should().BeTrue();
        parent.Variants.Should().Contain(child);
    }

    [Fact(DisplayName = "Crear variante hija sobre un ítem que no es matriz es rechazado")]
    public void CreateVariantChild_NonMatrixParent_ReturnsError()
    {
        var tenantId = Guid.CreateVersion7();
        var regularItemResult = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Ítem Normal",
            description: null,
            sku: "SKU-NORM",
            basePrice: 5.0m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        regularItemResult.IsSuccess.Should().BeTrue();
        var regularItem = regularItemResult.Value!;

        var childResult = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            regularItem,
            variantTitle: "Variante",
            sku: "SKU-CHILD",
            basePrice: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson);

        childResult.IsFailure.Should().BeTrue();
        childResult.Error!.Code.Should().Be("catalog.matrix.parent.invalid");
    }

    [Fact(DisplayName = "No se permite anidamiento de variantes en más de un nivel")]
    public void CreateVariantChild_NestedMoreThanOneLevel_ReturnsError()
    {
        var tenantId = Guid.CreateVersion7();
        var parentResult = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín",
            null,
            "CALC",
            3.0m,
            null,
            "[{\"name\": \"Talla\", \"values\": [\"M\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson);

        parentResult.IsSuccess.Should().BeTrue();
        var parent = parentResult.Value!;

        var childResult = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "M",
            "CALC-M",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson);

        childResult.IsSuccess.Should().BeTrue();
        var child = childResult.Value!;

        // Intentar crear un "hijo del hijo"
        var grandchildResult = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            child, // child no es matriz ni debe tener hijos
            "Sub-variante",
            "CALC-M-1",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson);

        grandchildResult.IsFailure.Should().BeTrue();
    }
}
