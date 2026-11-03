using EcuNexo.Core.Catalog;
using EcuNexo.Core.Catalog.ValueObjects;

namespace EcuNexo.Core.UnitTests.Catalog;

public sealed class CatalogItemThumbnailResolverTests
{
    private static readonly ImageDimensions DefaultDims = ImageDimensions.Create(800, 800).Value!;

    [Fact(DisplayName = "Modo model: padre e hijas heredan la foto general del modelo")]
    public void RecalculateTreeThumbnails_ModelMode_ParentAndVariantsInheritModelImage()
    {
        var tenantId = Guid.CreateVersion7();
        const string dimsJson = """[{"name":"talla","values":["S","M"],"photoGroup":false}]""";

        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Camiseta Básica",
            description: null,
            modelCode: "CAM",
            basePrice: 15m,
            variantDimensionsJson: dimsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var childS = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Talla S",
            "CAM-S",
            15m,
            """{"talla":"S"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(childS);

        parent.AddImage(
            Guid.CreateVersion7(),
            storageKey: "orig/model.webp",
            originalFileName: "model.webp",
            altText: null,
            dimensions: DefaultDims,
            fileSizeBytes: 12000,
            thumbUrl: "/media/thumb/model.webp",
            mediumUrl: "/media/med/model.webp",
            largeUrl: "/media/large/model.webp",
            groupValue: null);

        parent.ResolvedThumbUrl.Should().Be("/media/thumb/model.webp");
        parent.ResolvedMediumUrl.Should().Be("/media/med/model.webp");
        childS.ResolvedThumbUrl.Should().Be("/media/thumb/model.webp");
        childS.ResolvedMediumUrl.Should().Be("/media/med/model.webp");
    }

    [Fact(DisplayName = "Modo group mono-eje con color_hex: variante con etiqueta texto y #HEX resuelve imagen por #HEX y mantiene IsMain por grupo")]
    public void RecalculateTreeThumbnails_SingleAxisColorHexGroup_ResolvesCorrectGroupAndScopesIsMain()
    {
        var tenantId = Guid.CreateVersion7();
        const string dimsJson = """[{"name":"color","values":["Rojo (#FF0000)","Azul (#0000FF)"],"photoGroup":true},{"name":"talla","values":["S","M"],"photoGroup":false}]""";

        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Buzo Deportivo",
            description: null,
            modelCode: "BUZ",
            basePrice: 30m,
            variantDimensionsJson: dimsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var childRojo = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Rojo · S",
            "BUZ-ROJ-S",
            30m,
            """{"color":"Rojo","color_hex":"#FF0000","talla":"S"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(childRojo);

        var childAzul = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Azul · M",
            "BUZ-AZU-M",
            30m,
            """{"color":"Azul","color_hex":"#0000FF","talla":"M"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(childAzul);

        var imgRojo = parent.AddImage(
            Guid.CreateVersion7(),
            "orig/rojo.webp",
            "rojo.webp",
            null,
            DefaultDims,
            10000,
            "/media/thumb/rojo.webp",
            "/media/med/rojo.webp",
            "/media/large/rojo.webp",
            groupValue: "#FF0000").Value!;

        var imgAzul = parent.AddImage(
            Guid.CreateVersion7(),
            "orig/azul.webp",
            "azul.webp",
            null,
            DefaultDims,
            10000,
            "/media/thumb/azul.webp",
            "/media/med/azul.webp",
            "/media/large/azul.webp",
            groupValue: "#0000FF").Value!;

        imgRojo.IsMain.Should().BeTrue();
        imgAzul.IsMain.Should().BeTrue();

        parent.ResolvedThumbUrl.Should().Be("/media/thumb/rojo.webp");
        childRojo.ResolvedThumbUrl.Should().Be("/media/thumb/rojo.webp");
        childAzul.ResolvedThumbUrl.Should().Be("/media/thumb/azul.webp");
    }

    [Fact(DisplayName = "Modo group multi-eje compuesto (caña|color): variante resuelve clave compuesta Alta|#457fc9")]
    public void RecalculateTreeThumbnails_MultiAxisCompositeGroup_ResolvesCompositeKey()
    {
        var tenantId = Guid.CreateVersion7();
        const string dimsJson = """[{"name":"caña","values":["Alta","Baja"],"photoGroup":true},{"name":"color","values":["Azul (#457fc9)"],"photoGroup":true}]""";

        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Botín",
            description: null,
            modelCode: "BOT",
            basePrice: 55m,
            variantDimensionsJson: dimsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var childAlta = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Alta · Azul",
            "BOT-ALT-AZ",
            55m,
            """{"caña":"Alta","color":"Azul","color_hex":"#457fc9"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(childAlta);

        var childBaja = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Baja · Azul",
            "BOT-BAJ-AZ",
            55m,
            """{"caña":"Baja","color":"Azul","color_hex":"#457fc9"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(childBaja);

        parent.AddImage(
            Guid.CreateVersion7(),
            "orig/baja-az.webp",
            "baja-az.webp",
            null,
            DefaultDims,
            10000,
            "/media/thumb/baja-az.webp",
            "/media/med/baja-az.webp",
            "/media/large/baja-az.webp",
            groupValue: "Baja|#457fc9");

        parent.AddImage(
            Guid.CreateVersion7(),
            "orig/alta-az.webp",
            "alta-az.webp",
            null,
            DefaultDims,
            10000,
            "/media/thumb/alta-az.webp",
            "/media/med/alta-az.webp",
            "/media/large/alta-az.webp",
            groupValue: "Alta|#457fc9");

        childAlta.ResolvedThumbUrl.Should().Be("/media/thumb/alta-az.webp");
        childBaja.ResolvedThumbUrl.Should().Be("/media/thumb/baja-az.webp");
        parent.ResolvedThumbUrl.Should().Be("/media/thumb/alta-az.webp");
    }

    [Fact(DisplayName = "Modo variant (por SKU): padre sin fotos propias hereda portada de la primera variante activa con imagen")]
    public void RecalculateTreeThumbnails_VariantMode_ParentInheritsFromFirstVariantWithImage()
    {
        var tenantId = Guid.CreateVersion7();
        const string dimsJson = """[{"name":"presentacion","values":["250ml","500ml"],"photoGroup":false}]""";

        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Jarabe",
            description: null,
            modelCode: "JAR",
            basePrice: 10m,
            variantDimensionsJson: dimsJson,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var child250 = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "250ml",
            "JAR-250",
            10m,
            """{"presentacion":"250ml"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        child250.SetSortOrder(0);
        parent.AddVariantChild(child250);

        var child500 = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "500ml",
            "JAR-500",
            18m,
            """{"presentacion":"500ml"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        child500.SetSortOrder(1);
        parent.AddVariantChild(child500);

        child500.AddImage(
            Guid.CreateVersion7(),
            "orig/500.webp",
            "500.webp",
            null,
            DefaultDims,
            9000,
            "/media/thumb/500.webp",
            "/media/med/500.webp",
            "/media/large/500.webp",
            groupValue: null);

        parent.ResolvedThumbUrl.Should().Be("/media/thumb/500.webp");
        child500.ResolvedThumbUrl.Should().Be("/media/thumb/500.webp");
        child250.ResolvedThumbUrl.Should().BeNull();

        child250.AddImage(
            Guid.CreateVersion7(),
            "orig/250.webp",
            "250.webp",
            null,
            DefaultDims,
            9000,
            "/media/thumb/250.webp",
            "/media/med/250.webp",
            "/media/large/250.webp",
            groupValue: null);

        parent.ResolvedThumbUrl.Should().Be("/media/thumb/250.webp");
        child250.ResolvedThumbUrl.Should().Be("/media/thumb/250.webp");
    }
}
