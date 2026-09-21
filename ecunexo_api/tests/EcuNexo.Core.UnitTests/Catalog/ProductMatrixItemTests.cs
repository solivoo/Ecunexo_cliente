using System.Text.Json;
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

    [Fact(DisplayName = "CreateVariantChild hereda precio del producto matriz y permite sobreescritura")]
    public void CreateVariantChild_InheritsParentBasePrice_AndAllowsOverride()
    {
        var tenantId = Guid.CreateVersion7();
        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Camiseta",
            null,
            "CAM-01",
            25.00m,
            null,
            "[{\"name\": \"Talla\", \"values\": [\"S\", \"XL\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        // Variante 1: hereda precio del padre
        var child1 = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "S",
            "CAM-01-0001",
            basePrice: null,
            customAttributesJson: null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        child1.BasePrice.Should().Be(25.00m);

        // Variante 2: sobreescribe precio por talla especial
        var child2 = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "XL",
            "CAM-01-0002",
            basePrice: 28.50m,
            customAttributesJson: null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        child2.BasePrice.Should().Be(28.50m);
    }

    [Fact(DisplayName = "CreateVariantChild hereda atributos y descuentos del padre cuando el campo se llama igual")]
    public void CreateVariantChild_InheritsParentCustomAttributesAndDiscounts_WhenChildHasAdditionalAttributes()
    {
        var tenantId = Guid.CreateVersion7();
        var parentAttributes = """{"material":"Algodon Peinado","descuento":10,"marca":"Nike"}""";
        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetines Nike",
            null,
            "NIK-001",
            15.00m,
            null,
            "[{\"name\": \"Caña\", \"values\": [\"Corta\"]}]",
            parentAttributes,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        // Variante hija agrega "actividad": "Running" sin sobreescribir descuento
        var childAttributes = """{"actividad":"Running","cana":"Corta"}""";
        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña corta",
            "NIK-001-0001",
            basePrice: null,
            childAttributes,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        child.CustomAttributesJson.Should().Contain("\"material\":\"Algodon Peinado\"");
        child.CustomAttributesJson.Should().Contain("\"descuento\":10");
        child.CustomAttributesJson.Should().Contain("\"marca\":\"Nike\"");
        child.CustomAttributesJson.Should().Contain("\"actividad\":\"Running\"");
    }

    [Fact(DisplayName = "CreateVariantChild sobreescribe descuento o atributo del padre si el campo se llama igual")]
    public void CreateVariantChild_OverridesParentAttribute_WhenFieldNameMatches()
    {
        var tenantId = Guid.CreateVersion7();
        var parentAttributes = """{"material":"Algodon","descuento":10,"marca":"Adidas"}""";
        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetines Adidas",
            null,
            "ADI-001",
            12.00m,
            null,
            "[{\"name\": \"Caña\", \"values\": [\"Larga\"]}]",
            parentAttributes,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        // Variante define su propio descuento de 20 en lugar de 10
        var childAttributes = """{"descuento":20,"actividad":"Skater"}""";
        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña Larga",
            "ADI-001-0002",
            basePrice: null,
            childAttributes,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        child.CustomAttributesJson.Should().Contain("\"descuento\":20");
        child.CustomAttributesJson.Should().NotContain("\"descuento\":10");
        child.CustomAttributesJson.Should().Contain("\"marca\":\"Adidas\"");
        child.CustomAttributesJson.Should().Contain("\"actividad\":\"Skater\"");
    }

    [Fact(DisplayName = "NormalizeVariantDimensions acepta el arreglo canónico y normaliza cada dimensión")]
    public void NormalizeVariantDimensions_CanonicalArray_NormalizesDimensions()
    {
        var result = CatalogItem.NormalizeVariantDimensions(
            """[{"name":" Talla ","values":["S"," M ",""]}]""");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("""[{"name":"Talla","values":["S","M"]}]""");
    }

    [Fact(DisplayName = "NormalizeVariantDimensions acepta el formato envuelto y devuelve el arreglo canónico")]
    public void NormalizeVariantDimensions_WrappedObject_ReturnsCanonicalArray()
    {
        var result = CatalogItem.NormalizeVariantDimensions(
            """{"dimensions":[{"name":"Color","values":["Negro","Blanco"]}]}""");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("""[{"name":"Color","values":["Negro","Blanco"]}]""");
    }

    [Fact(DisplayName = "NormalizeVariantDimensions rechaza un formato desconocido")]
    public void NormalizeVariantDimensions_UnknownShape_ReturnsError()
    {
        var result = CatalogItem.NormalizeVariantDimensions("""{"foo":"bar"}""");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.matrix.dimensions.array");
    }

    [Fact(DisplayName = "NormalizeHierarchyPath normaliza y descarta entradas sin nombre o valor")]
    public void NormalizeHierarchyPath_NormalizesAndSkipsIncompleteEntries()
    {
        var result = CatalogItem.NormalizeHierarchyPath(
            """[{"level":"Modelo","name":" Caña ","value":" Corta "},{"level":"Modelo","name":"Bordado","value":"  "}]""");

        result.IsSuccess.Should().BeTrue();
        using var doc = JsonDocument.Parse(result.Value!);
        doc.RootElement.GetArrayLength().Should().Be(1);
        doc.RootElement[0].GetProperty("level").GetString().Should().Be("Modelo");
        doc.RootElement[0].GetProperty("name").GetString().Should().Be("Caña");
        doc.RootElement[0].GetProperty("value").GetString().Should().Be("Corta");
    }

    [Fact(DisplayName = "NormalizeHierarchyPath sin datos devuelve null")]
    public void NormalizeHierarchyPath_Empty_ReturnsNull()
    {
        CatalogItem.NormalizeHierarchyPath(null).Value.Should().BeNull();
        CatalogItem.NormalizeHierarchyPath("[]").Value.Should().BeNull();
    }

    [Fact(DisplayName = "NormalizeHierarchyPath rechaza una raíz que no sea arreglo")]
    public void NormalizeHierarchyPath_ObjectRoot_ReturnsError()
    {
        var result = CatalogItem.NormalizeHierarchyPath("""{"level":"Modelo"}""");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.hierarchy.path.invalid");
    }

    [Fact(DisplayName = "Variante hija hereda arquetipo y ruta jerárquica del producto matriz")]
    public void CreateVariantChild_InheritsFamilyAndHierarchyPath()
    {
        var tenantId = Guid.CreateVersion7();
        var familyId = Guid.CreateVersion7();
        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetines Nike",
            null,
            "NIK-FAM-01",
            12.00m,
            null,
            """[{"name":"Talla","values":["S","M"]}]""",
            """{"material":"Algodón"}""",
            CatalogAttributeSchema.EmptyArrayJson,
            familyId: familyId,
            hierarchyPathJson: """[{"level":"Modelo","name":"Material","value":"Algodón"}]""").Value!;

        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Talla S",
            "NIK-FAM-01-S",
            basePrice: null,
            customAttributesJson: """{"talla":"S"}""",
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        child.FamilyId.Should().Be(familyId);
        child.HierarchyPathJson.Should().Be(parent.HierarchyPathJson);
    }
}
