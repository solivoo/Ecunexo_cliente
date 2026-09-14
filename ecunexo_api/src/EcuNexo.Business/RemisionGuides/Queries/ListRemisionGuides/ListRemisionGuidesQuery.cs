using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Business.RemisionGuides.Queries.ListRemisionGuides;

public sealed record RemisionGuideSummaryDto(
    Guid Id,
    string DocumentNumber,
    string AccessKey,
    DateOnly IssueDate,
    RemisionGuideStatus Status,
    string CarrierName,
    string LicensePlate,
    string RecipientName,
    string RouteDescription,
    DateOnly StartDate,
    DateOnly EndDate,
    int ItemsCount,
    string? AuthorizationNumber,
    DateTimeOffset? AuthorizationDate);

public sealed record ListRemisionGuidesResponse(
    IReadOnlyList<RemisionGuideSummaryDto> Guides,
    int TotalCount,
    int AuthorizedCount,
    int InTransitCount,
    int DeliveredCount,
    int DraftCount);

public sealed record ListRemisionGuidesQuery(
    Guid TenantId,
    RemisionGuideStatus? Status = null,
    DateOnly? From = null,
    DateOnly? To = null,
    string? Search = null) : IQuery<ListRemisionGuidesResponse>;

public sealed class ListRemisionGuidesHandler : IQueryHandler<ListRemisionGuidesQuery, ListRemisionGuidesResponse>
{
    private readonly IRemisionGuideRepository _repository;

    public ListRemisionGuidesHandler(IRemisionGuideRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<ListRemisionGuidesResponse>> Handle(ListRemisionGuidesQuery query, CancellationToken ct = default)
    {
        var guides = await _repository.ListAsync(
            query.TenantId,
            query.Status,
            query.From,
            query.To,
            query.Search,
            ct).ConfigureAwait(false);

        var dtos = guides.Select(g => new RemisionGuideSummaryDto(
            g.Id,
            g.DocumentNumber,
            g.AccessKey,
            g.IssueDate,
            g.Status,
            g.CarrierName,
            g.LicensePlate,
            g.RecipientName,
            g.RouteDescription,
            g.StartDate,
            g.EndDate,
            g.Items.Count,
            g.AuthorizationNumber,
            g.AuthorizationDate)).ToList();

        var total = dtos.Count;
        var authorized = dtos.Count(g => g.Status == RemisionGuideStatus.Authorized);
        var inTransit = dtos.Count(g => g.Status == RemisionGuideStatus.InTransit);
        var delivered = dtos.Count(g => g.Status == RemisionGuideStatus.Delivered);
        var draft = dtos.Count(g => g.Status == RemisionGuideStatus.Draft);

        return Result.Success(new ListRemisionGuidesResponse(
            dtos,
            total,
            authorized,
            inTransit,
            delivered,
            draft));
    }
}
