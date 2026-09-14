using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.RemisionGuides;

/// <summary>
/// Guía de Remisión Electrónica (SRI Comprobante Tipo 06).
/// Documento tributario que ampara el traslado de mercaderías dentro del territorio ecuatoriano.
/// </summary>
public sealed class RemisionGuide : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int EstablishmentMaxLength = 3;
    public const int EmissionPointMaxLength = 3;
    public const int SequentialMaxLength = 9;
    public const int AccessKeyLength = 49;
    public const int IdentificationMaxLength = 20;
    public const int NameMaxLength = 300;
    public const int AddressMaxLength = 300;
    public const int RouteMaxLength = 300;
    public const int ReasonMaxLength = 300;
    public const int LicensePlateMaxLength = 20;

    private readonly List<RemisionGuideItem> _items = [];

    private RemisionGuide()
    {
    }

    public Guid TenantId { get; private set; }
    public string Establishment { get; private set; } = "001";
    public string EmissionPoint { get; private set; } = "001";
    public string Sequential { get; private set; } = "000000001";
    public string DocumentNumber => $"{Establishment}-{EmissionPoint}-{Sequential}";

    public string AccessKey { get; private set; } = string.Empty;
    public DateOnly IssueDate { get; private set; }
    public RemisionGuideStatus Status { get; private set; } = RemisionGuideStatus.Draft;
    public string? AuthorizationNumber { get; private set; }
    public DateTimeOffset? AuthorizationDate { get; private set; }
    public string? SriMessages { get; private set; }
    public string? XmlContent { get; private set; }

    // Datos del Transportista / Chofer
    public string CarrierIdentificationType { get; private set; } = "04";
    public string CarrierIdentification { get; private set; } = string.Empty;
    public string CarrierName { get; private set; } = string.Empty;
    public string? CarrierEmail { get; private set; }
    public string? CarrierPhone { get; private set; }
    public string LicensePlate { get; private set; } = string.Empty;

    // Traslado
    public string StartingAddress { get; private set; } = string.Empty;
    public DateOnly StartDate { get; private set; }
    public DateOnly EndDate { get; private set; }

    // Destinatario y Ruta
    public string RecipientIdentificationType { get; private set; } = "04";
    public string RecipientIdentification { get; private set; } = string.Empty;
    public string RecipientName { get; private set; } = string.Empty;
    public string RecipientAddress { get; private set; } = string.Empty;
    public string TransferReason { get; private set; } = string.Empty;
    public string RouteDescription { get; private set; } = string.Empty;

    // Documento de Sustento
    public string? SupportDocumentType { get; private set; }
    public string? SupportDocumentNumber { get; private set; }
    public string? SupportDocumentAuth { get; private set; }
    public string? CustomsDocumentNumber { get; private set; }

    // Ítems transportados
    public IReadOnlyCollection<RemisionGuideItem> Items => _items.AsReadOnly();

    // Auditoría
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }

    public static Result<RemisionGuide> Create(
        Guid id,
        Guid tenantId,
        string establishment,
        string emissionPoint,
        string sequential,
        DateOnly issueDate,
        string startingAddress,
        DateOnly startDate,
        DateOnly endDate,
        string carrierIdentificationType,
        string carrierIdentification,
        string carrierName,
        string licensePlate,
        string recipientIdentificationType,
        string recipientIdentification,
        string recipientName,
        string recipientAddress,
        string transferReason,
        string routeDescription,
        string? carrierEmail = null,
        string? carrierPhone = null,
        string? supportDocumentType = null,
        string? supportDocumentNumber = null,
        string? supportDocumentAuth = null,
        string? customsDocumentNumber = null,
        string? accessKey = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.id.empty", "El Id de la guía es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.tenant_id.empty", "El tenantId es obligatorio.", ErrorType.Validation));
        }

        // Normalizar serie
        var cleanEstab = (establishment?.Trim() ?? "001").PadLeft(3, '0');
        var cleanPto = (emissionPoint?.Trim() ?? "001").PadLeft(3, '0');
        var cleanSeq = (sequential?.Trim() ?? "1").PadLeft(9, '0');

        if (cleanEstab.Length != 3 || !cleanEstab.All(char.IsDigit))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.establishment.invalid", "El establecimiento debe constar de 3 dígitos.", ErrorType.Validation));
        }

        if (cleanPto.Length != 3 || !cleanPto.All(char.IsDigit))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.emission_point.invalid", "El punto de emisión debe constar de 3 dígitos.", ErrorType.Validation));
        }

        if (cleanSeq.Length != 9 || !cleanSeq.All(char.IsDigit))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.sequential.invalid", "El secuencial debe constar de 9 dígitos.", ErrorType.Validation));
        }

        // Validar transportista
        var cleanCarrierId = carrierIdentification?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanCarrierId) || cleanCarrierId.Length < 10)
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.carrier_id.invalid", "La identificación del transportista (RUC/Cédula) es obligatoria y debe tener al menos 10 dígitos.", ErrorType.Validation));
        }

        var cleanCarrierName = carrierName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanCarrierName))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.carrier_name.empty", "La razón social o nombre del transportista es obligatorio.", ErrorType.Validation));
        }

        var cleanPlate = licensePlate?.Trim().ToUpperInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanPlate))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.license_plate.empty", "La placa del vehículo de transporte es obligatoria.", ErrorType.Validation));
        }

        // Validar fechas de traslado
        if (endDate < startDate)
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.dates.invalid", "La fecha de fin de transporte no puede ser anterior a la fecha de inicio.", ErrorType.Validation));
        }

        var cleanStartAddr = startingAddress?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanStartAddr))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.starting_address.empty", "El punto de partida del traslado es obligatorio.", ErrorType.Validation));
        }

        // Validar destinatario
        var cleanRecipId = recipientIdentification?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanRecipId) || cleanRecipId.Length < 10)
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.recipient_id.invalid", "La identificación del destinatario es obligatoria y debe tener al menos 10 dígitos.", ErrorType.Validation));
        }

        var cleanRecipName = recipientName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanRecipName))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.recipient_name.empty", "La razón social o nombre del destinatario es obligatorio.", ErrorType.Validation));
        }

        var cleanRecipAddr = recipientAddress?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanRecipAddr))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.recipient_address.empty", "La dirección de destino es obligatoria.", ErrorType.Validation));
        }

        var cleanReason = transferReason?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanReason))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.transfer_reason.empty", "El motivo del traslado es obligatorio.", ErrorType.Validation));
        }

        var cleanRoute = routeDescription?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(cleanRoute))
        {
            return Result.Failure<RemisionGuide>(new Error("remision_guide.route.empty", "La ruta de transporte es obligatoria.", ErrorType.Validation));
        }

        var guide = new RemisionGuide
        {
            Id = id,
            TenantId = tenantId,
            Establishment = cleanEstab,
            EmissionPoint = cleanPto,
            Sequential = cleanSeq,
            IssueDate = issueDate,
            Status = RemisionGuideStatus.Draft,
            StartingAddress = cleanStartAddr,
            StartDate = startDate,
            EndDate = endDate,
            CarrierIdentificationType = string.IsNullOrWhiteSpace(carrierIdentificationType) ? "04" : carrierIdentificationType.Trim(),
            CarrierIdentification = cleanCarrierId,
            CarrierName = cleanCarrierName,
            CarrierEmail = string.IsNullOrWhiteSpace(carrierEmail) ? null : carrierEmail.Trim(),
            CarrierPhone = string.IsNullOrWhiteSpace(carrierPhone) ? null : carrierPhone.Trim(),
            LicensePlate = cleanPlate,
            RecipientIdentificationType = string.IsNullOrWhiteSpace(recipientIdentificationType) ? "04" : recipientIdentificationType.Trim(),
            RecipientIdentification = cleanRecipId,
            RecipientName = cleanRecipName,
            RecipientAddress = cleanRecipAddr,
            TransferReason = cleanReason,
            RouteDescription = cleanRoute,
            SupportDocumentType = string.IsNullOrWhiteSpace(supportDocumentType) ? null : supportDocumentType.Trim(),
            SupportDocumentNumber = string.IsNullOrWhiteSpace(supportDocumentNumber) ? null : supportDocumentNumber.Trim(),
            SupportDocumentAuth = string.IsNullOrWhiteSpace(supportDocumentAuth) ? null : supportDocumentAuth.Trim(),
            CustomsDocumentNumber = string.IsNullOrWhiteSpace(customsDocumentNumber) ? null : customsDocumentNumber.Trim(),
            AccessKey = accessKey?.Trim() ?? string.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        };

        return Result.Success(guide);
    }

    public Result AddItem(RemisionGuideItem item)
    {
        if (item is null)
        {
            return Result.Failure(new Error("remision_guide.item.null", "El ítem a agregar no puede ser nulo.", ErrorType.Validation));
        }

        if (Status != RemisionGuideStatus.Draft)
        {
            return Result.Failure(new Error("remision_guide.not_draft", "No se pueden agregar ítems a una guía que ya ha sido emitida o autorizada.", ErrorType.Validation));
        }

        _items.Add(item);
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public void SetAccessKey(string accessKey)
    {
        AccessKey = accessKey?.Trim() ?? string.Empty;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetXmlContent(string xml)
    {
        XmlContent = xml;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkIssued(Guid? userId = null)
    {
        if (Status == RemisionGuideStatus.Draft)
        {
            Status = RemisionGuideStatus.Issued;
            UpdatedAt = DateTimeOffset.UtcNow;
            UpdatedBy = userId;
        }
    }

    public void MarkAuthorized(string authorizationNumber, DateTimeOffset? authDate = null, Guid? userId = null)
    {
        Status = RemisionGuideStatus.Authorized;
        AuthorizationNumber = authorizationNumber.Trim();
        AuthorizationDate = authDate ?? DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = userId;
    }

    public void MarkInTransit(Guid? userId = null)
    {
        if (Status == RemisionGuideStatus.Authorized || Status == RemisionGuideStatus.Issued)
        {
            Status = RemisionGuideStatus.InTransit;
            UpdatedAt = DateTimeOffset.UtcNow;
            UpdatedBy = userId;
        }
    }

    public void MarkDelivered(Guid? userId = null)
    {
        if (Status == RemisionGuideStatus.InTransit || Status == RemisionGuideStatus.Authorized)
        {
            Status = RemisionGuideStatus.Delivered;
            UpdatedAt = DateTimeOffset.UtcNow;
            UpdatedBy = userId;
        }
    }

    public void Cancel(string reason, Guid? userId = null)
    {
        Status = RemisionGuideStatus.Cancelled;
        SriMessages = reason;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = userId;
    }

    public void SoftDelete(Guid? userId = null)
    {
        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = userId;
    }
}
