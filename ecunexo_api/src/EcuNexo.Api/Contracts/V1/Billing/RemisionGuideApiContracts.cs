using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Api.Contracts.V1.Billing;

public sealed record CreateRemisionGuideItemApiRequest(
    string ItemCode,
    string Description,
    decimal Quantity,
    string? UnitOfMeasure = null,
    string? InternalReference = null);

public sealed record CreateRemisionGuideApiRequest(
    string Establishment,
    string EmissionPoint,
    string? Sequential,
    DateOnly IssueDate,
    string StartingAddress,
    DateOnly StartDate,
    DateOnly EndDate,
    string CarrierIdentificationType,
    string CarrierIdentification,
    string CarrierName,
    string LicensePlate,
    string RecipientIdentificationType,
    string RecipientIdentification,
    string RecipientName,
    string RecipientAddress,
    string TransferReason,
    string RouteDescription,
    string? CarrierEmail = null,
    string? CarrierPhone = null,
    string? SupportDocumentType = null,
    string? SupportDocumentNumber = null,
    string? SupportDocumentAuth = null,
    string? CustomsDocumentNumber = null,
    IReadOnlyList<CreateRemisionGuideItemApiRequest>? Items = null,
    bool EmitSri = false);

public sealed record UpdateRemisionGuideStatusApiRequest(
    RemisionGuideStatus NewStatus,
    string? Reason = null);
