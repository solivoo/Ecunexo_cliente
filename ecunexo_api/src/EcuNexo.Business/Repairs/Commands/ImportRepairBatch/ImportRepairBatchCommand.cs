using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Repairs.Commands.ImportRepairBatch;

public sealed record ImportRepairBatchCommand(
    Guid TenantId,
    Guid CustomerId,
    string BatchNumber,
    Guid? TemplateId,
    decimal? AgreedRateN1,
    decimal? AgreedRateN2,
    decimal? AgreedRateN3,
    string? ContractReference,
    DateTimeOffset? ExpectedCompletionAt,
    Stream ExcelStream,
    IReadOnlyList<int>? ExcludedRowNumbers = null,
    IReadOnlyList<string>? ExcludedSerialNumbers = null,
    Guid? CreatedBy = null) : ICommand<ImportRepairBatchResponse>;

public sealed record ImportRepairBatchResponse(
    Guid BatchId,
    string BatchNumber,
    int TotalImported,
    int Level1Count,
    int Level2Count,
    int Level3Count,
    IReadOnlyList<string> Warnings);
