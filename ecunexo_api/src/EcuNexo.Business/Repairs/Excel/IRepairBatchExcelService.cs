using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Excel;

public sealed class ParsedBatchEquipmentItem
{
    public int RowNumber { get; set; }
    public string SerialNumber { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string? ProductLine { get; set; }
    public DamageLevel DamageLevel { get; set; }
    public string CustomAttributesJson { get; set; } = "{}";
}

public sealed class ParsedBatchResult
{
    public bool IsSuccess => Errors.Count == 0;
    public List<ParsedBatchEquipmentItem> Items { get; set; } = [];
    public List<string> Errors { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
}

public interface IRepairBatchExcelService
{
    byte[] GenerateTemplateWorkbook(RepairBatchTemplate template);
    ParsedBatchResult ParseBatchWorkbook(Stream excelStream, RepairBatchTemplate template);
}
