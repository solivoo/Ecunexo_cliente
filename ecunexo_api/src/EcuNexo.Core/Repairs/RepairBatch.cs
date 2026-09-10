using System.Text.Json;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Lote de electrodomésticos / equipos recibidos en el taller bajo un mismo envío de un cliente corporativo.
/// </summary>
public sealed class RepairBatch : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int BatchNumberMaxLength = 50;
    public const int ContractReferenceMaxLength = 100;

    private readonly List<RepairEquipment> _equipments = [];
    private readonly List<RepairDispatch> _dispatches = [];

    private RepairBatch()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid CustomerId { get; private set; }

    public Customer? Customer { get; private set; }

    public Guid? TemplateId { get; private set; }

    public RepairBatchTemplate? Template { get; private set; }

    public string BatchNumber { get; private set; } = string.Empty;

    public RepairBatchStatus Status { get; private set; } = RepairBatchStatus.Received;

    public int TotalCount { get; private set; }

    public int ReceivedCount { get; private set; }

    public int InRepairCount { get; private set; }

    public int ReadyCount { get; private set; }

    public int DispatchedCount { get; private set; }

    /// <summary>Tarifa unitaria pactada para reparación de Nivel 1 (Leve / Estético).</summary>
    public decimal? AgreedRateN1 { get; private set; }

    /// <summary>Tarifa unitaria pactada para reparación de Nivel 2 (Medio / Chapa y Mecánica ligera).</summary>
    public decimal? AgreedRateN2 { get; private set; }

    /// <summary>Tarifa unitaria pactada para reparación de Nivel 3 (Grave / Estructural y Funcional).</summary>
    public decimal? AgreedRateN3 { get; private set; }

    public string? ContractReference { get; private set; }

    public DateTimeOffset? ExpectedCompletionAt { get; private set; }

    public DateTimeOffset ReceivedAt { get; private set; }

    public string MetadataJson { get; private set; } = "{}";

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyCollection<RepairEquipment> Equipments => _equipments.AsReadOnly();

    public IReadOnlyCollection<RepairDispatch> Dispatches => _dispatches.AsReadOnly();

    public static Result<RepairBatch> Create(
        Guid id,
        Guid tenantId,
        Guid customerId,
        string batchNumber,
        Guid? templateId = null,
        decimal? agreedRateN1 = null,
        decimal? agreedRateN2 = null,
        decimal? agreedRateN3 = null,
        string? contractReference = null,
        DateTimeOffset? expectedCompletionAt = null,
        DateTimeOffset? receivedAt = null,
        string? metadataJson = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RepairBatch>(new Error("repairs.batch.id.empty", "El Id del lote es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<RepairBatch>(new Error("repairs.batch.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (customerId == Guid.Empty)
        {
            return Result.Failure<RepairBatch>(new Error("repairs.batch.customer.empty", "El cliente corporativo es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(batchNumber))
        {
            return Result.Failure<RepairBatch>(new Error("repairs.batch.number.empty", "El número de lote es obligatorio.", ErrorType.Validation));
        }

        var trimmedNumber = batchNumber.Trim();
        if (trimmedNumber.Length > BatchNumberMaxLength)
        {
            return Result.Failure<RepairBatch>(new Error("repairs.batch.number.toolong", $"El número de lote no puede exceder {BatchNumberMaxLength} caracteres.", ErrorType.Validation));
        }

        return new RepairBatch
        {
            Id = id,
            TenantId = tenantId,
            CustomerId = customerId,
            TemplateId = templateId,
            BatchNumber = trimmedNumber,
            Status = RepairBatchStatus.Received,
            TotalCount = 0,
            ReceivedCount = 0,
            InRepairCount = 0,
            ReadyCount = 0,
            DispatchedCount = 0,
            AgreedRateN1 = agreedRateN1,
            AgreedRateN2 = agreedRateN2,
            AgreedRateN3 = agreedRateN3,
            ContractReference = contractReference?.Trim(),
            ExpectedCompletionAt = expectedCompletionAt,
            ReceivedAt = receivedAt ?? DateTimeOffset.UtcNow,
            MetadataJson = NormalizeMetadata(metadataJson),
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public void RecalculateCounters(int total, int received, int inRepair, int ready, int dispatched)
    {
        TotalCount = total;
        ReceivedCount = received;
        InRepairCount = inRepair;
        ReadyCount = ready;
        DispatchedCount = dispatched;

        // Transición de estado del lote automática según contadores
        if (TotalCount > 0 && DispatchedCount == TotalCount)
        {
            Status = RepairBatchStatus.Completed;
        }
        else if (DispatchedCount > 0)
        {
            Status = RepairBatchStatus.PartiallyDispatched;
        }
        else if (InRepairCount > 0 || ReadyCount > 0)
        {
            Status = RepairBatchStatus.InProgress;
        }
        else
        {
            Status = RepairBatchStatus.Received;
        }

        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateAgreedRates(decimal? rateN1, decimal? rateN2, decimal? rateN3)
    {
        AgreedRateN1 = rateN1;
        AgreedRateN2 = rateN2;
        AgreedRateN3 = rateN3;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Close()
    {
        Status = RepairBatchStatus.Closed;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static string NormalizeMetadata(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return "{}";
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return json.Trim();
        }
        catch
        {
            return "{}";
        }
    }
}
