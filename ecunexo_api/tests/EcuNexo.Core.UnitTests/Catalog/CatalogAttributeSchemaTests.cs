namespace EcuNexo.Core.UnitTests.Catalog;

using EcuNexo.Core.Catalog;

public sealed class CatalogAttributeSchemaTests
{
    [Fact(DisplayName = "Color obligatorio vacío (arreglo) se rechaza")]
    public void ValidateAgainstSchema_RequiredEmptyColorArray_Fails()
    {
        const string schema = """[{"key":"color","label":"Color","type":"color","required":true}]""";
        const string attributes = """{"color":[]}""";

        var result = CatalogAttributeSchema.ValidateAgainstSchema(schema, attributes);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.attributes.required");
    }

    [Fact(DisplayName = "Varios hex en color obligatorio pasan")]
    public void ValidateAgainstSchema_RequiredColorList_Succeeds()
    {
        const string schema = """[{"key":"color","label":"Color","type":"color","required":true}]""";
        const string attributes = """{"color":["#111827","#DC2626"]}""";

        var result = CatalogAttributeSchema.ValidateAgainstSchema(schema, attributes);

        result.IsSuccess.Should().BeTrue();
    }
}
