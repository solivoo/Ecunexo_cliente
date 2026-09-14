using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Business.RemisionGuides.Queries.GetRemisionGuideById;

public sealed record RemisionGuideItemDetailDto(
    Guid Id,
    string ItemCode,
    string Description,
    decimal Quantity,
    string? UnitOfMeasure,
    string? InternalReference);

public sealed record RemisionGuideDetailDto(
    Guid Id,
    Guid TenantId,
    string Establishment,
    string EmissionPoint,
    string Sequential,
    string DocumentNumber,
    string AccessKey,
    DateOnly IssueDate,
    RemisionGuideStatus Status,
    string? AuthorizationNumber,
    DateTimeOffset? AuthorizationDate,
    string? SriMessages,
    string? XmlContent,
    string CarrierIdentificationType,
    string CarrierIdentification,
    string CarrierName,
    string? CarrierEmail,
    string? CarrierPhone,
    string LicensePlate,
    string StartingAddress,
    DateOnly StartDate,
    DateOnly EndDate,
    string RecipientIdentificationType,
    string RecipientIdentification,
    string RecipientName,
    string RecipientAddress,
    string TransferReason,
    string RouteDescription,
    string? SupportDocumentType,
    string? SupportDocumentNumber,
    string? SupportDocumentAuth,
    string? CustomsDocumentNumber,
    IReadOnlyList<RemisionGuideItemDetailDto> Items,
    DateTimeOffset CreatedAt);

public sealed record GetRemisionGuideByIdQuery(Guid TenantId, Guid Id) : IQuery<RemisionGuideDetailDto>;

public sealed class GetRemisionGuideByIdHandler : IQueryHandler<GetRemisionGuideByIdQuery, RemisionGuideDetailDto>
{
    private readonly IRemisionGuideRepository _repository;

    public GetRemisionGuideByIdHandler(IRemisionGuideRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<RemisionGuideDetailDto>> Handle(GetRemisionGuideByIdQuery query, CancellationToken ct = default)
    {
        var guide = await _repository.GetByIdAsync(query.TenantId, query.Id, ct).ConfigureAwait(false);
        if (guide is null)
        {
            return Result.Failure<RemisionGuideDetailDto>(new Error("remision_guide.not_found", "La guía de remisión no existe.", ErrorType.NotFound));
        }

        var itemDtos = guide.Items.Select(i => new RemisionGuideItemDetailDto(
            i.Id,
            i.ItemCode,
            i.Description,
            i.Quantity,
            i.UnitOfMeasure,
            i.InternalReference)).ToList();

        var detail = new RemisionGuideDetailDto(
            guide.Id,
            guide.TenantId,
            guide.Establishment,
            guide.EmissionPoint,
            guide.Sequential,
            guide.DocumentNumber,
            guide.AccessKey,
            guide.IssueDate,
            guide.Status,
            guide.AuthorizationNumber,
            guide.AuthorizationDate,
            guide.SriMessages,
            guide.XmlContent,
            guide.CarrierIdentificationType,
            guide.CarrierIdentification,
            guide.CarrierName,
            guide.CarrierEmail,
            guide.CarrierPhone,
            guide.LicensePlate,
            guide.StartingAddress,
            guide.StartDate,
            guide.EndDate,
            guide.RecipientIdentificationType,
            guide.RecipientIdentification,
            guide.RecipientName,
            guide.RecipientAddress,
            guide.TransferReason,
            guide.RouteDescription,
            guide.SupportDocumentType,
            guide.SupportDocumentNumber,
            guide.SupportDocumentAuth,
            guide.CustomsDocumentNumber,
            itemDtos,
            guide.CreatedAt);

        return Result.Success(detail);
    }
}
