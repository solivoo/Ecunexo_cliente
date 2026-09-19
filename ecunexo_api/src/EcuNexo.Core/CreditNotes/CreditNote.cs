using System.Text.RegularExpressions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.CreditNotes;

/// <summary>
/// Agregado Raíz para la Nota de Crédito Electrónica SRI (Comprobante Tipo 04).
/// Documento tributario que anula, modifica o aplica descuentos sobre un comprobante de venta autorizado.
/// </summary>
public partial class CreditNote : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int EstablishmentMaxLength = 3;
    public const int EmissionPointMaxLength = 3;
    public const int SequentialMaxLength = 9;
    public const int AccessKeyLength = 49;
    public const int IdentificationMaxLength = 20;
    public const int NameMaxLength = 300;
    public const int AddressMaxLength = 300;
    public const int ReasonMaxLength = 300;
    public const int DocumentNumberLength = 15;

    private readonly List<CreditNoteItem> _items = [];
    private readonly List<CreditNoteAdditionalField> _additionalFields = [];

    private CreditNote()
    {
    }

    public Guid TenantId { get; private set; }
    public string Establishment { get; private set; } = "001";
    public string EmissionPoint { get; private set; } = "001";
    public string Sequential { get; private set; } = "000000001";
    public string DocumentNumber => $"{Establishment}-{EmissionPoint}-{Sequential}";

    public string AccessKey { get; private set; } = string.Empty;
    public DateOnly IssueDate { get; private set; }
    public CreditNoteStatus Status { get; private set; } = CreditNoteStatus.Draft;
    public CreditNoteReasonType ReasonType { get; private set; } = CreditNoteReasonType.MerchandiseReturn;
    public string Reason { get; private set; } = string.Empty;

    // Comprobante Sustento Modificado
    public string ModifiedDocumentType { get; private set; } = "01";
    public string ModifiedDocumentNumber { get; private set; } = string.Empty;
    public DateOnly ModifiedDocumentIssueDate { get; private set; }
    public string? ModifiedDocumentAuthorizationNumber { get; private set; }
    public Guid? ModifiedDocumentId { get; private set; }

    // Comprador / Receptor
    public string BuyerIdentificationType { get; private set; } = "04";
    public string BuyerIdentification { get; private set; } = string.Empty;
    public string BuyerName { get; private set; } = string.Empty;
    public string BuyerAddress { get; private set; } = string.Empty;
    public string? BuyerEmail { get; private set; }

    // Totales Monetarios
    public decimal SubtotalWithoutTaxes { get; private set; }
    public decimal TotalDiscount { get; private set; }
    public decimal SubtotalVat15 { get; private set; }
    public decimal SubtotalVat13 { get; private set; }
    public decimal SubtotalVat12 { get; private set; }
    public decimal SubtotalVat0 { get; private set; }
    public decimal SubtotalNoVat { get; private set; }
    public decimal SubtotalExemptVat { get; private set; }
    public decimal VatAmount { get; private set; }
    public decimal ModificationValue { get; private set; }

    // Información Adicional / SRI
    public string Environment { get; private set; } = "1";
    public string? AuthorizationNumber { get; private set; }
    public DateTimeOffset? AuthorizationDate { get; private set; }
    public string? SriMessages { get; private set; }
    public string? XmlContent { get; private set; }

    public IReadOnlyCollection<CreditNoteItem> Items => _items.AsReadOnly();
    public IReadOnlyCollection<CreditNoteAdditionalField> AdditionalFields => _additionalFields.AsReadOnly();

    // Auditoría
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }

    public static Result<CreditNote> Create(
        Guid id,
        Guid tenantId,
        string establishment,
        string emissionPoint,
        string sequential,
        DateOnly issueDate,
        CreditNoteReasonType reasonType,
        string reason,
        string modifiedDocumentType,
        string modifiedDocumentNumber,
        DateOnly modifiedDocumentIssueDate,
        string buyerIdentificationType,
        string buyerIdentification,
        string buyerName,
        string buyerAddress,
        string? buyerEmail = null,
        string? modifiedDocumentAuthorizationNumber = null,
        Guid? modifiedDocumentId = null,
        string environment = "1",
        string? accessKey = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<CreditNote>(new Error("credit_note.id_required", "El ID de la Nota de Crédito es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<CreditNote>(new Error("credit_note.tenant_required", "El ID del tenant es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<CreditNote>(new Error("credit_note.reason_required", "El motivo de la Nota de Crédito es obligatorio.", ErrorType.Validation));
        }

        if (reason.Trim().Length > ReasonMaxLength)
        {
            return Result.Failure<CreditNote>(new Error("credit_note.reason_too_long", $"El motivo no puede exceder {ReasonMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(modifiedDocumentNumber))
        {
            return Result.Failure<CreditNote>(new Error("credit_note.modified_document_required", "El número del documento modificado es obligatorio.", ErrorType.Validation));
        }

        var cleanModifiedDocNumber = modifiedDocumentNumber.Trim();
        if (!ModifiedDocumentNumberRegex().IsMatch(cleanModifiedDocNumber))
        {
            return Result.Failure<CreditNote>(new Error("credit_note.modified_document_format_invalid", "El número del documento modificado debe tener el formato '001-001-000000001' (15 caracteres).", ErrorType.Validation));
        }

        if (issueDate < modifiedDocumentIssueDate)
        {
            return Result.Failure<CreditNote>(new Error("credit_note.issue_date_before_sustento", "La fecha de emisión de la Nota de Crédito no puede ser anterior a la fecha del documento sustento.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(buyerName))
        {
            return Result.Failure<CreditNote>(new Error("credit_note.buyer_name_required", "La razón social o nombre del comprador es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(buyerIdentification))
        {
            return Result.Failure<CreditNote>(new Error("credit_note.buyer_identification_required", "La identificación del comprador es obligatoria.", ErrorType.Validation));
        }

        var estabPart = (establishment ?? "001").Trim().PadLeft(3, '0');
        var ptoPart = (emissionPoint ?? "001").Trim().PadLeft(3, '0');
        var seqPart = (sequential ?? "1").Trim().PadLeft(9, '0');

        var creditNote = new CreditNote
        {
            Id = id,
            TenantId = tenantId,
            Establishment = estabPart,
            EmissionPoint = ptoPart,
            Sequential = seqPart,
            IssueDate = issueDate,
            Status = CreditNoteStatus.Draft,
            ReasonType = reasonType,
            Reason = reason.Trim(),
            ModifiedDocumentType = string.IsNullOrWhiteSpace(modifiedDocumentType) ? "01" : modifiedDocumentType.Trim(),
            ModifiedDocumentNumber = cleanModifiedDocNumber,
            ModifiedDocumentIssueDate = modifiedDocumentIssueDate,
            ModifiedDocumentAuthorizationNumber = modifiedDocumentAuthorizationNumber?.Trim(),
            ModifiedDocumentId = modifiedDocumentId,
            BuyerIdentificationType = string.IsNullOrWhiteSpace(buyerIdentificationType) ? "04" : buyerIdentificationType.Trim(),
            BuyerIdentification = buyerIdentification.Trim(),
            BuyerName = buyerName.Trim(),
            BuyerAddress = string.IsNullOrWhiteSpace(buyerAddress) ? "ECUADOR" : buyerAddress.Trim(),
            BuyerEmail = buyerEmail?.Trim(),
            Environment = environment == "2" ? "2" : "1",
            AccessKey = accessKey ?? string.Empty
        };

        return Result.Success(creditNote);
    }

    public Result AddItem(CreditNoteItem item)
    {
        if (item == null)
        {
            return Result.Failure(new Error("credit_note.null_item", "El ítem no puede ser nulo.", ErrorType.Validation));
        }

        _items.Add(item);
        RecalculateTotals();
        return Result.Success();
    }

    public void AddAdditionalField(string name, string value)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        _additionalFields.Add(new CreditNoteAdditionalField(name, value));
    }

    public void SetAccessKey(string accessKey)
    {
        if (!string.IsNullOrWhiteSpace(accessKey))
        {
            AccessKey = accessKey.Trim();
        }
    }

    public void SetXmlContent(string xmlContent)
    {
        XmlContent = xmlContent;
    }

    public Result MarkAsIssued()
    {
        if (Status != CreditNoteStatus.Draft && Status != CreditNoteStatus.Rejected)
        {
            return Result.Failure(new Error("credit_note.invalid_status_transition", $"No se puede emitir una Nota de Crédito en estado '{Status}'.", ErrorType.Validation));
        }

        if (_items.Count == 0)
        {
            return Result.Failure(new Error("credit_note.no_items", "La Nota de Crédito debe tener al menos un ítem para ser emitida.", ErrorType.Validation));
        }

        Status = CreditNoteStatus.Issued;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result MarkAsAuthorized(string authorizationNumber, DateTimeOffset authorizationDate, string? sriMessages = null)
    {
        if (string.IsNullOrWhiteSpace(authorizationNumber))
        {
            return Result.Failure(new Error("credit_note.auth_number_required", "El número de autorización del SRI es obligatorio.", ErrorType.Validation));
        }

        Status = CreditNoteStatus.Authorized;
        AuthorizationNumber = authorizationNumber.Trim();
        AuthorizationDate = authorizationDate;
        SriMessages = sriMessages;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result MarkAsRejected(string sriMessages)
    {
        Status = CreditNoteStatus.Rejected;
        SriMessages = sriMessages;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result MarkAsCancelled(string? reason = null)
    {
        if (Status == CreditNoteStatus.Authorized)
        {
            return Result.Failure(new Error("credit_note.cannot_cancel_authorized", "Una Nota de Crédito autorizada por el SRI no puede anularse localmente sin proceso previo.", ErrorType.Validation));
        }

        Status = CreditNoteStatus.Cancelled;
        if (!string.IsNullOrWhiteSpace(reason))
        {
            SriMessages = $"Anulado localmente: {reason}";
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    private void RecalculateTotals()
    {
        SubtotalWithoutTaxes = _items.Sum(i => i.Subtotal);
        TotalDiscount = _items.Sum(i => i.Discount);

        SubtotalVat15 = _items.Where(i => i.VatPercentageCode == "4").Sum(i => i.Subtotal);
        SubtotalVat13 = _items.Where(i => i.VatPercentageCode == "10").Sum(i => i.Subtotal);
        SubtotalVat12 = _items.Where(i => i.VatPercentageCode == "2").Sum(i => i.Subtotal);
        SubtotalVat0 = _items.Where(i => i.VatPercentageCode == "0").Sum(i => i.Subtotal);
        SubtotalNoVat = _items.Where(i => i.VatPercentageCode == "6").Sum(i => i.Subtotal);
        SubtotalExemptVat = _items.Where(i => i.VatPercentageCode == "7").Sum(i => i.Subtotal);

        VatAmount = _items.Sum(i => i.VatAmount);
        ModificationValue = SubtotalWithoutTaxes + VatAmount;
    }

    [GeneratedRegex(@"^\d{3}-\d{3}-\d{9}$")]
    private static partial Regex ModifiedDocumentNumberRegex();
}
