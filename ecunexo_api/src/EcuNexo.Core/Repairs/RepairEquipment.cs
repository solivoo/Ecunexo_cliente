using System.Text.Json;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Electrodoméstico o equipo individual que forma parte de un lote en el taller.
/// </summary>
public sealed class RepairEquipment : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int SerialNumberMaxLength = 60;
    public const int ModelMaxLength = 60;
    public const int BrandMaxLength = 60;
    public const int ProductLineMaxLength = 60;

    private readonly List<RepairEquipmentPhoto> _photos = [];
    private readonly List<RepairEquipmentEvent> _events = [];

    private RepairEquipment()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid BatchId { get; private set; }

    public RepairBatch? Batch { get; private set; }

    public Guid? AssignedTechnicianId { get; private set; }

    public string SerialNumber { get; private set; } = string.Empty;

    public string Model { get; private set; } = string.Empty;

    public string Brand { get; private set; } = string.Empty;

    public string? ProductLine { get; private set; }

    public DamageLevel DamageLevel { get; private set; }

    public RepairEquipmentStatus Status { get; private set; } = RepairEquipmentStatus.Received;

    public string? DiagnosticNotes { get; private set; }

    public string? RepairNotes { get; private set; }

    public string? QualityCheckNotes { get; private set; }

    public bool? PassedQualityCheck { get; private set; }

    public DateTimeOffset? DiagnosedAt { get; private set; }

    public DateTimeOffset? RepairedAt { get; private set; }

    public DateTimeOffset? QualityCheckedAt { get; private set; }

    /// <summary>Tarifa final aplicada a este equipo para la facturación.</summary>
    public decimal? ServiceFeeApplied { get; private set; }

    /// <summary>Columnas adicionales del Excel guardadas dinámicamente como JSONB.</summary>
    public string CustomAttributesJson { get; private set; } = "{}";

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyCollection<RepairEquipmentPhoto> Photos => _photos.AsReadOnly();

    public IReadOnlyCollection<RepairEquipmentEvent> Events => _events.AsReadOnly();

    public static Result<RepairEquipment> Create(
        Guid id,
        Guid tenantId,
        Guid batchId,
        string serialNumber,
        string model,
        string brand,
        DamageLevel damageLevel,
        string? productLine = null,
        string? customAttributesJson = null,
        Guid? assignedTechnicianId = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RepairEquipment>(new Error("repairs.equipment.id.empty", "El Id del equipo es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<RepairEquipment>(new Error("repairs.equipment.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (batchId == Guid.Empty)
        {
            return Result.Failure<RepairEquipment>(new Error("repairs.equipment.batch.empty", "El Id de lote es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(serialNumber))
        {
            return Result.Failure<RepairEquipment>(new Error("repairs.equipment.serial.empty", "El número de serie es obligatorio.", ErrorType.Validation));
        }

        var trimmedSerial = serialNumber.Trim();
        if (trimmedSerial.Length > SerialNumberMaxLength)
        {
            return Result.Failure<RepairEquipment>(new Error("repairs.equipment.serial.toolong", $"El número de serie no puede exceder {SerialNumberMaxLength} caracteres.", ErrorType.Validation));
        }

        return new RepairEquipment
        {
            Id = id,
            TenantId = tenantId,
            BatchId = batchId,
            SerialNumber = trimmedSerial,
            Model = model?.Trim() ?? string.Empty,
            Brand = brand?.Trim() ?? string.Empty,
            ProductLine = productLine?.Trim(),
            DamageLevel = damageLevel,
            Status = RepairEquipmentStatus.Received,
            CustomAttributesJson = NormalizeJson(customAttributesJson),
            AssignedTechnicianId = assignedTechnicianId,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public void AssignTechnician(Guid technicianId, Guid? modifiedBy = null)
    {
        AssignedTechnicianId = technicianId;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;
    }

    public Result StartDiagnosis(Guid? technicianId = null, string? notes = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.Received)
        {
            return Result.Failure(new Error("repairs.equipment.invalid_transition", $"No se puede iniciar diagnóstico desde el estado {Status}.", ErrorType.Validation));
        }

        if (technicianId.HasValue)
        {
            AssignedTechnicianId = technicianId.Value;
        }

        Status = RepairEquipmentStatus.Diagnosing;
        DiagnosticNotes = notes?.Trim();
        DiagnosedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result StartRepair(string? notes = null, DamageLevel? confirmedLevel = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.Received && Status != RepairEquipmentStatus.Diagnosing && Status != RepairEquipmentStatus.QualityCheck)
        {
            return Result.Failure(new Error("repairs.equipment.invalid_transition", $"No se puede iniciar reparación desde el estado {Status}.", ErrorType.Validation));
        }

        if (confirmedLevel.HasValue)
        {
            DamageLevel = confirmedLevel.Value;
        }

        Status = RepairEquipmentStatus.InRepair;
        RepairNotes = notes?.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result SendToQualityCheck(string? notes = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.InRepair)
        {
            return Result.Failure(new Error("repairs.equipment.invalid_transition", $"El equipo debe estar en reparación para pasar a control de calidad.", ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.QualityCheck;
        RepairedAt = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            RepairNotes = string.IsNullOrWhiteSpace(RepairNotes) ? notes.Trim() : $"{RepairNotes}\n{notes.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result ApproveQualityCheck(string? notes = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.QualityCheck)
        {
            return Result.Failure(new Error("repairs.equipment.invalid_transition", $"El equipo no está en control de calidad.", ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.ReadyToDispatch;
        PassedQualityCheck = true;
        QualityCheckNotes = notes?.Trim();
        QualityCheckedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result RejectQualityCheck(string reason, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.QualityCheck)
        {
            return Result.Failure(new Error("repairs.equipment.invalid_transition", $"El equipo no está en control de calidad.", ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.InRepair;
        PassedQualityCheck = false;
        QualityCheckNotes = reason.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result MarkDispatched(Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.ReadyToDispatch)
        {
            return Result.Failure(new Error("repairs.equipment.not_ready", "Solo se pueden despachar equipos aprobados y listos para retiro.", ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.Dispatched;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result MarkInvoiced(decimal serviceFee, Guid? modifiedBy = null)
    {
        Status = RepairEquipmentStatus.Invoiced;
        ServiceFeeApplied = serviceFee;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result MarkIrreparable(string reason, Guid? modifiedBy = null)
    {
        Status = RepairEquipmentStatus.Irreparable;
        DiagnosticNotes = string.IsNullOrWhiteSpace(DiagnosticNotes)
            ? $"[IRREPARABLE]: {reason.Trim()}"
            : $"{DiagnosticNotes}\n[IRREPARABLE]: {reason.Trim()}";
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    /// <summary>
    /// Marca el equipo como devuelto sin reparar mediante acta de salida (estado Irreparable despachado).
    /// Válido desde: Irreparable.
    /// </summary>
    public Result MarkReturnedUnrepaired(string? notes = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.Irreparable)
        {
            return Result.Failure(new Error(
                "repairs.equipment.invalid_transition",
                $"Solo se pueden devolver como 'sin reparar' equipos en estado Irreparable (estado actual: {Status}).",
                ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.ReturnedUnrepaired;
        if (!string.IsNullOrWhiteSpace(notes))
        {
            DiagnosticNotes = string.IsNullOrWhiteSpace(DiagnosticNotes)
                ? $"[DEVUELTO SIN REPARAR]: {notes.Trim()}"
                : $"{DiagnosticNotes}\n[DEVUELTO SIN REPARAR]: {notes.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    /// <summary>
    /// Marca el equipo como retirado por el cliente o rechazado técnicamente antes de finalizar la reparación.
    /// Válido desde cualquier estado pre-despacho (Received, Diagnosing, InRepair, QualityCheck, Irreparable).
    /// </summary>
    public Result MarkReturnedClient(string? reason = null, Guid? modifiedBy = null)
    {
        var allowedStatuses = new[]
        {
            RepairEquipmentStatus.Received,
            RepairEquipmentStatus.Diagnosing,
            RepairEquipmentStatus.InRepair,
            RepairEquipmentStatus.QualityCheck,
            RepairEquipmentStatus.Irreparable,
        };

        if (!allowedStatuses.Contains(Status))
        {
            return Result.Failure(new Error(
                "repairs.equipment.invalid_transition",
                $"No se puede registrar retiro de cliente desde el estado {Status}.",
                ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.ReturnedClient;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            DiagnosticNotes = string.IsNullOrWhiteSpace(DiagnosticNotes)
                ? $"[RETIRO CLIENTE/RECHAZO]: {reason.Trim()}"
                : $"{DiagnosticNotes}\n[RETIRO CLIENTE/RECHAZO]: {reason.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public Result Cancel(string? reason = null, Guid? modifiedBy = null)
    {
        if (Status != RepairEquipmentStatus.Received && Status != RepairEquipmentStatus.Cancelled)
        {
            return Result.Failure(new Error("repairs.equipment.cannot_cancel_processed", "Solo se pueden anular equipos no intervenidos en diagnóstico o reparación.", ErrorType.Validation));
        }

        Status = RepairEquipmentStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            DiagnosticNotes = string.IsNullOrWhiteSpace(DiagnosticNotes)
                ? $"[ANULADO]: {reason.Trim()}"
                : $"{DiagnosticNotes}\n[ANULADO]: {reason.Trim()}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    private static string NormalizeJson(string? json)
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
