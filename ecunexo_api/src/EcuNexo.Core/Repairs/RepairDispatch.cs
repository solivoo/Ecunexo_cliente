using System.Security.Cryptography;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Despacho / Acta de entrega oficial de equipos reparados con código QR de verificación.
/// </summary>
public sealed class RepairDispatch : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int DispatchNumberMaxLength = 50;
    public const int CarrierNameMaxLength = 120;
    public const int CarrierDocumentMaxLength = 30;
    public const int CarrierVehiclePlateMaxLength = 20;

    private readonly List<RepairDispatchItem> _items = [];

    private RepairDispatch()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid BatchId { get; private set; }

    public RepairBatch? Batch { get; private set; }

    public string DispatchNumber { get; private set; } = string.Empty;

    public RepairDispatchStatus Status { get; private set; } = RepairDispatchStatus.Draft;

    public string? CarrierName { get; private set; }

    public string? CarrierDocument { get; private set; }

    public string? CarrierVehiclePlate { get; private set; }

    /// <summary>Hash criptográfico único que se codifica en el QR para validación pública anónima de autenticidad.</summary>
    public string VerificationHash { get; private set; } = string.Empty;

    public string? QrCodeUrl { get; private set; }

    public string? Notes { get; private set; }

    /// <summary>Id de la factura electrónica SRI emitida en el módulo billing.</summary>
    public Guid? InvoiceId { get; private set; }

    public DateTimeOffset? DispatchedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public IReadOnlyCollection<RepairDispatchItem> Items => _items.AsReadOnly();

    public static Result<RepairDispatch> Create(
        Guid id,
        Guid tenantId,
        Guid batchId,
        string dispatchNumber,
        string? carrierName = null,
        string? carrierDocument = null,
        string? carrierVehiclePlate = null,
        string? notes = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RepairDispatch>(new Error("repairs.dispatch.id.empty", "El Id del despacho es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<RepairDispatch>(new Error("repairs.dispatch.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (batchId == Guid.Empty)
        {
            return Result.Failure<RepairDispatch>(new Error("repairs.dispatch.batch.empty", "El Id del lote es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(dispatchNumber))
        {
            return Result.Failure<RepairDispatch>(new Error("repairs.dispatch.number.empty", "El número de despacho es obligatorio.", ErrorType.Validation));
        }

        var trimmedNumber = dispatchNumber.Trim();
        if (trimmedNumber.Length > DispatchNumberMaxLength)
        {
            return Result.Failure<RepairDispatch>(new Error("repairs.dispatch.number.toolong", $"El número de despacho no puede exceder {DispatchNumberMaxLength} caracteres.", ErrorType.Validation));
        }

        var verificationHash = GenerateVerificationHash(tenantId, id, trimmedNumber);

        return new RepairDispatch
        {
            Id = id,
            TenantId = tenantId,
            BatchId = batchId,
            DispatchNumber = trimmedNumber,
            Status = RepairDispatchStatus.Draft,
            CarrierName = carrierName?.Trim(),
            CarrierDocument = carrierDocument?.Trim(),
            CarrierVehiclePlate = carrierVehiclePlate?.Trim(),
            VerificationHash = verificationHash,
            Notes = notes?.Trim(),
            CreatedBy = createdBy,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public void AddItem(RepairDispatchItem item)
    {
        _items.Add(item);
    }

    public Result Confirm(
        string? carrierName = null,
        string? carrierDocument = null,
        string? carrierVehiclePlate = null,
        Guid? modifiedBy = null)
    {
        if (Status != RepairDispatchStatus.Draft)
        {
            return Result.Failure(new Error("repairs.dispatch.already_confirmed", "El despacho ya fue confirmado previamente.", ErrorType.Validation));
        }

        if (_items.Count == 0)
        {
            return Result.Failure(new Error("repairs.dispatch.items.empty", "El despacho debe incluir al menos un equipo.", ErrorType.Validation));
        }

        Status = RepairDispatchStatus.Confirmed;
        if (!string.IsNullOrWhiteSpace(carrierName))
        {
            CarrierName = carrierName.Trim();
        }
        if (!string.IsNullOrWhiteSpace(carrierDocument))
        {
            CarrierDocument = carrierDocument.Trim();
        }
        if (!string.IsNullOrWhiteSpace(carrierVehiclePlate))
        {
            CarrierVehiclePlate = carrierVehiclePlate.Trim();
        }
        DispatchedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    public void LinkInvoice(Guid invoiceId, Guid? modifiedBy = null)
    {
        InvoiceId = invoiceId;
        Status = RepairDispatchStatus.Invoiced;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;
    }

    private static string GenerateVerificationHash(Guid tenantId, Guid dispatchId, string dispatchNumber)
    {
        var raw = $"{tenantId:N}-{dispatchId:N}-{dispatchNumber}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
        var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash)[..32].ToLowerInvariant();
    }
}
