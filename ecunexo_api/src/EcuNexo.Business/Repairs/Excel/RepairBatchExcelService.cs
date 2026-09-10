using System.Text.Json;
using ClosedXML.Excel;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Excel;

public sealed class RepairBatchExcelService : IRepairBatchExcelService
{
    public byte[] GenerateTemplateWorkbook(RepairBatchTemplate template)
    {
        var schema = RepairTemplateSchemaDefaults.ParseSchema(template.ColumnDefinitionsJson);
        if (schema.Columns.Count == 0)
        {
            schema = RepairTemplateSchemaDefaults.ParseSchema(RepairTemplateSchemaDefaults.GetDefaultWhirlpoolSchemaJson());
        }

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Equipos Lote");

        // Configurar cabeceras
        for (var i = 0; i < schema.Columns.Count; i++)
        {
            var col = schema.Columns[i];
            var cell = ws.Cell(1, i + 1);
            cell.Value = col.Label;
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0152C9");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

            // Validación desplegable nativa de Excel para selects
            if (col.Type == "select" && col.Options.Count > 0)
            {
                var optionsCsv = string.Join(",", col.Options);
                var validationRange = ws.Range(2, i + 1, 500, i + 1);
                validationRange.CreateDataValidation().List($"\"{optionsCsv}\"", true);
            }

            // Fila de ejemplo 1
            if (!string.IsNullOrWhiteSpace(col.Example))
            {
                ws.Cell(2, i + 1).Value = col.Example;
            }
            else if (!string.IsNullOrWhiteSpace(col.DefaultValue))
            {
                ws.Cell(2, i + 1).Value = col.DefaultValue;
            }
        }

        ws.Row(1).Height = 26;
        ws.Columns().AdjustToContents(12.0, 45.0);

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    public ParsedBatchResult ParseBatchWorkbook(Stream excelStream, RepairBatchTemplate template)
    {
        var result = new ParsedBatchResult();
        var schema = RepairTemplateSchemaDefaults.ParseSchema(template.ColumnDefinitionsJson);

        using var workbook = new XLWorkbook(excelStream);
        var ws = workbook.Worksheets.FirstOrDefault();
        if (ws == null)
        {
            result.Errors.Add("El archivo Excel no contiene ninguna hoja de cálculo.");
            return result;
        }

        var headerRow = ws.Row(1);
        var lastCellUsed = headerRow.LastCellUsed();
        if (lastCellUsed == null)
        {
            result.Errors.Add("La primera fila del archivo debe contener las cabeceras de columna.");
            return result;
        }

        // Mapear índice de columna a definición o clave
        var columnMap = new Dictionary<int, string>();
        for (var colIdx = 1; colIdx <= lastCellUsed.Address.ColumnNumber; colIdx++)
        {
            var headerText = headerRow.Cell(colIdx).GetString().Trim();
            if (string.IsNullOrWhiteSpace(headerText))
            {
                continue;
            }

            var matchedCol = schema.Columns.FirstOrDefault(c =>
                string.Equals(c.Label, headerText, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(c.Key, headerText, StringComparison.OrdinalIgnoreCase));

            columnMap[colIdx] = matchedCol?.Key ?? Slugify(headerText);
        }

        var seenSerials = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var lastRowNumber = ws.LastRowUsed()?.RowNumber() ?? 1;

        for (var rowNum = 2; rowNum <= lastRowNumber; rowNum++)
        {
            var row = ws.Row(rowNum);
            if (row.IsEmpty())
            {
                continue;
            }

            var item = new ParsedBatchEquipmentItem { RowNumber = rowNum };
            var customAttrs = new Dictionary<string, string>();

            foreach (var (colIdx, key) in columnMap)
            {
                var val = row.Cell(colIdx).GetString().Trim();
                if (string.IsNullOrWhiteSpace(val))
                {
                    continue;
                }

                switch (key.ToLowerInvariant())
                {
                    case "serial_number":
                    case "serie":
                    case "numero_serie":
                        item.SerialNumber = val;
                        break;
                    case "model":
                    case "modelo":
                        item.Model = val;
                        break;
                    case "brand":
                    case "marca":
                        item.Brand = val;
                        break;
                    case "product_line":
                    case "linea":
                    case "tipo":
                        item.ProductLine = val;
                        break;
                    case "damage_level":
                    case "nivel":
                    case "nivel_golpe":
                    case "nivel_dano":
                        item.DamageLevel = RepairTemplateSchemaDefaults.ParseDamageLevel(val);
                        break;
                    default:
                        customAttrs[key] = val;
                        break;
                }
            }

            // Ignorar fila si está vacía
            if (string.IsNullOrWhiteSpace(item.SerialNumber) && string.IsNullOrWhiteSpace(item.Model))
            {
                continue;
            }

            // Validación de serie obligatoria
            if (string.IsNullOrWhiteSpace(item.SerialNumber))
            {
                result.Errors.Add($"Fila {rowNum}: El número de serie está vacío.");
                continue;
            }

            // Validación de serie duplicada dentro del mismo lote
            if (!seenSerials.Add(item.SerialNumber))
            {
                result.Errors.Add($"Fila {rowNum}: El número de serie '{item.SerialNumber}' está duplicado dentro de este lote.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(item.Brand))
            {
                item.Brand = "Whirlpool";
            }

            if (item.DamageLevel == 0)
            {
                item.DamageLevel = DamageLevel.Level1;
            }

            item.CustomAttributesJson = customAttrs.Count > 0
                ? JsonSerializer.Serialize(customAttrs)
                : "{}";

            result.Items.Add(item);
        }

        if (result.Items.Count == 0 && result.Errors.Count == 0)
        {
            result.Errors.Add("No se encontraron registros válidos de equipos en la plantilla.");
        }

        return result;
    }

    private static string Slugify(string text)
    {
        return text.Trim().ToLowerInvariant()
            .Replace(" ", "_")
            .Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u")
            .Replace("ñ", "n");
    }
}
