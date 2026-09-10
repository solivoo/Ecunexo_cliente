using ClosedXML.Excel;
using EcuNexo.Business.Repairs.Excel;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.UnitTests.Repairs;

public sealed class RepairBatchExcelServiceTests
{
    private readonly RepairBatchExcelService _service = new();

    [Fact(DisplayName = "GenerateTemplateWorkbook genera un Excel con cabeceras correctas")]
    public void GenerateTemplateWorkbook_ReturnsValidExcelWithHeaders()
    {
        var template = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla Whirlpool",
            RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson()).Value!;

        var bytes = _service.GenerateTemplateWorkbook(template);

        bytes.Should().NotBeNullOrEmpty();

        using var ms = new MemoryStream(bytes);
        using var workbook = new XLWorkbook(ms);
        var ws = workbook.Worksheet(1);

        ws.Cell(1, 1).GetString().Should().Be("Número de Serie");
        ws.Cell(1, 2).GetString().Should().Be("Modelo");
        ws.Cell(1, 3).GetString().Should().Be("Marca");
        ws.Cell(1, 4).GetString().Should().Be("Línea de Producto");
        ws.Cell(1, 5).GetString().Should().Be("Nivel de Golpe");
    }

    [Fact(DisplayName = "ParseBatchWorkbook parsea correctamente un archivo con 3 equipos de Whirlpool")]
    public void ParseBatchWorkbook_WithValidData_ReturnsParsedEquipments()
    {
        var template = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla Whirlpool",
            RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson()).Value!;

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Equipos");
        ws.Cell(1, 1).Value = "Número de Serie";
        ws.Cell(1, 2).Value = "Modelo";
        ws.Cell(1, 3).Value = "Marca";
        ws.Cell(1, 4).Value = "Línea de Producto";
        ws.Cell(1, 5).Value = "Nivel de Golpe";

        // Fila 1: Nivel 1
        ws.Cell(2, 1).Value = "SN-WPH-001";
        ws.Cell(2, 2).Value = "WWG16AK";
        ws.Cell(2, 3).Value = "Whirlpool";
        ws.Cell(2, 4).Value = "Lavadora";
        ws.Cell(2, 5).Value = "Nivel 1 (Leve)";

        // Fila 2: Nivel 2
        ws.Cell(3, 1).Value = "SN-WPH-002";
        ws.Cell(3, 2).Value = "WRM56AK";
        ws.Cell(3, 3).Value = "Whirlpool";
        ws.Cell(3, 4).Value = "Refrigeradora";
        ws.Cell(3, 5).Value = "Nivel 2 (Medio)";

        // Fila 3: Nivel 3
        ws.Cell(4, 1).Value = "SN-WPH-003";
        ws.Cell(4, 2).Value = "WED4815EW";
        ws.Cell(4, 3).Value = "Whirlpool";
        ws.Cell(4, 4).Value = "Secadora";
        ws.Cell(4, 5).Value = "Nivel 3 (Grave)";

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Position = 0;

        var result = _service.ParseBatchWorkbook(ms, template);

        result.IsSuccess.Should().BeTrue();
        result.Errors.Should().BeEmpty();
        result.Items.Should().HaveCount(3);

        result.Items[0].SerialNumber.Should().Be("SN-WPH-001");
        result.Items[0].Model.Should().Be("WWG16AK");
        result.Items[0].DamageLevel.Should().Be(DamageLevel.Level1);

        result.Items[1].SerialNumber.Should().Be("SN-WPH-002");
        result.Items[1].DamageLevel.Should().Be(DamageLevel.Level2);

        result.Items[2].SerialNumber.Should().Be("SN-WPH-003");
        result.Items[2].DamageLevel.Should().Be(DamageLevel.Level3);
    }

    [Fact(DisplayName = "ParseBatchWorkbook detecta números de serie duplicados en el lote")]
    public void ParseBatchWorkbook_WithDuplicateSerials_ReturnsErrors()
    {
        var template = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla Whirlpool",
            RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson()).Value!;

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Equipos");
        ws.Cell(1, 1).Value = "Número de Serie";
        ws.Cell(1, 2).Value = "Modelo";

        ws.Cell(2, 1).Value = "SN-REPETIDO";
        ws.Cell(2, 2).Value = "WWG16AK";

        ws.Cell(3, 1).Value = "SN-REPETIDO";
        ws.Cell(3, 2).Value = "WWG16AK";

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Position = 0;

        var result = _service.ParseBatchWorkbook(ms, template);

        result.IsSuccess.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("duplicado") && e.Contains("SN-REPETIDO"));
    }

    [Fact(DisplayName = "ParseBatchWorkbook empaqueta columnas adicionales no mapeadas en CustomAttributesJson")]
    public void ParseBatchWorkbook_WithUnknownColumns_CollectsCustomAttributesJson()
    {
        var template = RepairBatchTemplate.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Plantilla Whirlpool",
            RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson()).Value!;

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Equipos");
        ws.Cell(1, 1).Value = "Número de Serie";
        ws.Cell(1, 2).Value = "Modelo";
        ws.Cell(1, 3).Value = "Pallet Especial";
        ws.Cell(1, 4).Value = "Bodega Origen";

        ws.Cell(2, 1).Value = "SN-WPH-777";
        ws.Cell(2, 2).Value = "WWG16AK";
        ws.Cell(2, 3).Value = "PLT-SUR-99";
        ws.Cell(2, 4).Value = "CEDI Guayaquil";

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Position = 0;

        var result = _service.ParseBatchWorkbook(ms, template);

        result.IsSuccess.Should().BeTrue();
        result.Items.Should().HaveCount(1);
        result.Items[0].CustomAttributesJson.Should().Contain("PLT-SUR-99");
        result.Items[0].CustomAttributesJson.Should().Contain("CEDI Guayaquil");
    }
}
