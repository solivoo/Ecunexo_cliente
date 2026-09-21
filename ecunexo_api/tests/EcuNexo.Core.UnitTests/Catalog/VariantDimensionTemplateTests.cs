using EcuNexo.Core.Catalog;

namespace EcuNexo.Core.UnitTests.Catalog;

public sealed class VariantDimensionTemplateTests
{
    [Fact(DisplayName = "Creación de plantilla de escala válida tiene éxito")]
    public void Create_ValidTemplate_Succeeds()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();
        var valuesJson = "[\"35-38\", \"39-41\", \"42-44\"]";

        var result = VariantDimensionTemplate.Create(
            id,
            tenantId,
            "Medias / Calcetines",
            "size",
            valuesJson,
            isSystemDefault: false);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Medias / Calcetines");
        result.Value!.DimensionType.Should().Be("size");
        result.Value!.PredefinedValuesJson.Should().Contain("35-38");
        result.Value!.IsSystemDefault.Should().BeFalse();
    }

    [Fact(DisplayName = "Plantilla con valores JSON vacíos o inválidos es rechazada")]
    public void Create_InvalidValuesJson_Fails()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();

        var result = VariantDimensionTemplate.Create(
            id,
            tenantId,
            "Tallas",
            "size",
            "[]");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant_template.values.empty");
    }

    [Fact(DisplayName = "Plantilla con tipo de dato y eje de variante se persiste")]
    public void Create_WithTypedMetadata_Succeeds()
    {
        var result = VariantDimensionTemplate.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Color Único",
            "color",
            "[\"Blanco\"]",
            dataType: VariantDimensionTemplate.DataTypeColor,
            isVariantAxis: false);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DataType.Should().Be(VariantDimensionTemplate.DataTypeColor);
        result.Value.IsVariantAxis.Should().BeFalse();
    }

    [Fact(DisplayName = "Plantilla con tipo de dato no soportado es rechazada")]
    public void Create_InvalidDataType_Fails()
    {
        var result = VariantDimensionTemplate.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "Raro",
            "size",
            "[\"A\"]",
            dataType: "moneda");

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant_template.data_type.invalid");
    }

    [Fact(DisplayName = "Actualización de plantilla actualiza nombre y valores")]
    public void Update_Template_Succeeds()
    {
        var id = Guid.CreateVersion7();
        var tenantId = Guid.CreateVersion7();
        var templateResult = VariantDimensionTemplate.Create(
            id,
            tenantId,
            "Calzado",
            "size",
            "[\"38\", \"39\"]",
            isSystemDefault: true);

        templateResult.IsSuccess.Should().BeTrue();
        var template = templateResult.Value!;

        var result = template.Update("Calzado Modificado", "size", "[\"40\"]");

        result.IsSuccess.Should().BeTrue();
        template.Name.Should().Be("Calzado Modificado");
    }

    [Fact(DisplayName = "Plantillas por defecto del sistema incluyen medias, ropa y calzado")]
    public void GetSystemDefaultTemplates_ContainsStandardScales()
    {
        var defaults = VariantDimensionTemplate.GetSystemDefaultTemplates();

        defaults.Should().NotBeEmpty();
        defaults.Should().Contain(t => t.Name == "Medias / Calcetines" && t.DimensionType == "size");
        defaults.Should().Contain(t => t.Name == "Calzado Adulto (Ecuador / EUR)");
        defaults.Should().Contain(t => t.Name == "Ropa Adulto (Letras)");
    }
}
