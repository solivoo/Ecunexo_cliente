using EcuNexo.Business.Storefront;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class StorefrontFacetCatalogTests
{
    [Theory(DisplayName = "Canonicaliza claves con alias, mayúsculas y acentos")]
    [InlineData("talla", "talla", "Talla")]
    [InlineData("Tallas", "talla", "Talla")]
    [InlineData("Tallas Calcetín", "talla", "Talla")]
    [InlineData("size", "talla", "Talla")]
    [InlineData("Colores", "color", "Color")]
    [InlineData("Actividad / Uso", "actividad", "Actividad / Uso")]
    [InlineData("tipo_cana", "cana", "Tipo de caña")]
    [InlineData("Tipo de caña", "cana", "Tipo de caña")]
    [InlineData("CAÑA", "cana", "Tipo de caña")]
    [InlineData("Materiales", "material", "Material")]
    [InlineData("marca", "marca", "Marca")]
    [InlineData("Colección", "coleccion", "Colección")]
    public void TryCanonicalizeKey_MapsAliases(string rawKey, string expectedKey, string expectedLabel)
    {
        var success = StorefrontFacetCatalog.TryCanonicalizeKey(rawKey, out var key, out var label);

        success.Should().BeTrue();
        key.Should().Be(expectedKey);
        label.Should().Be(expectedLabel);
    }

    [Theory(DisplayName = "Rechaza claves internas y desconocidas")]
    [InlineData("tags")]
    [InlineData("colores_secundarios")]
    [InlineData("Colores Secundarios")]
    [InlineData("precio")]
    [InlineData("precio_base")]
    [InlineData("basePrice")]
    [InlineData("codigo")]
    [InlineData("código")]
    [InlineData("sku")]
    [InlineData("barcode")]
    [InlineData("codigo_barras")]
    [InlineData("desconocido")]
    [InlineData("")]
    public void TryCanonicalizeKey_RejectsExcludedAndUnknownKeys(string rawKey)
    {
        var success = StorefrontFacetCatalog.TryCanonicalizeKey(rawKey, out var key, out var label);

        success.Should().BeFalse();
        key.Should().BeEmpty();
        label.Should().BeEmpty();
    }

    [Fact(DisplayName = "Normaliza el valor recortando y colapsando espacios")]
    public void NormalizeValue_TrimsAndCollapsesWhitespace()
    {
        StorefrontFacetCatalog.NormalizeValue("  Talla   M  ").Should().Be("Talla M");
        StorefrontFacetCatalog.NormalizeValue("M").Should().Be("M");
        StorefrontFacetCatalog.NormalizeValue("   ").Should().BeEmpty();
    }

    [Theory(DisplayName = "La clave de agrupación ignora mayúsculas y acentos")]
    [InlineData("Caña Corta", "cana corta")]
    [InlineData("Colección", "coleccion")]
    [InlineData("TALLAS CALCETÍN", "tallas calcetin")]
    public void NormalizeForMatch_RemovesCaseAndDiacritics(string raw, string expected)
    {
        StorefrontFacetCatalog.NormalizeForMatch(raw).Should().Be(expected);
    }

    [Fact(DisplayName = "Extrae atributos de ficha, jerarquía y dimensiones de variantes")]
    public void ExtractAttributes_CombinesCustomHierarchyAndVariantDimensions()
    {
        var item = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Calcetín Runner",
            null,
            "MOD-01",
            3.5m,
            """[{"name":"Tallas","values":["M","L"]}]""",
            """
                {
                  "Tallas": "M",
                  "Marca": "Nike",
                  "tags": ["running"],
                  "precio": 3.5,
                  "detalle": { "peso": 1 },
                  "Colores": ["Rojo", "rojo"]
                }
                """,
            CatalogAttributeSchema.EmptyArrayJson,
            hierarchyPathJson: """[{"level":"Deporte","name":"Actividad / Uso","value":"Running"}]""").Value!;

        var variant = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            item,
            "Talla L",
            "MOD-01-0002",
            null,
            """{ "tipo_cana": "Corta", "Tallas": "L" }""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        item.AddVariantChild(variant);

        var attributes = StorefrontFacetCatalog.ExtractAttributes(item);

        attributes.Keys.Should().BeEquivalentTo(["talla", "color", "actividad", "cana", "marca"]);
        attributes["talla"].Should().Equal("M", "L");
        attributes["color"].Should().Equal("Rojo");
        attributes["actividad"].Should().Equal("Running");
        attributes["cana"].Should().Equal("Corta");
        attributes["marca"].Should().Equal("Nike");
    }

    [Fact(DisplayName = "Los valores compuestos se separan en opciones independientes")]
    public void ExtractAttributes_SplitsCompositeValues()
    {
        var item = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            CatalogItemKind.Physical,
            "Colección Alo",
            null,
            "MOD-02",
            4.5m,
            """[{"name":"Tallas","values":["M","L"]}]""",
            """
                {
                  "Actividad / Uso": "Running, Skater, Crossfit, Gym, deportiva, Alo, yoga",
                  "Tallas Calcetín": "35-38; 39-42"
                }
                """,
            CatalogAttributeSchema.EmptyArrayJson,
            hierarchyPathJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var attributes = StorefrontFacetCatalog.ExtractAttributes(item);

        attributes["actividad"].Should().Equal(
            "Running", "Skater", "Crossfit", "Gym", "Deportiva", "Alo", "Yoga");
        attributes["talla"].Should().Equal("35-38", "39-42");
    }
}
