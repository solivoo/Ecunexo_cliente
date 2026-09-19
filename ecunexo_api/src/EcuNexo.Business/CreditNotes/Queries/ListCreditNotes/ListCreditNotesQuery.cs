using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.CreditNotes;

namespace EcuNexo.Business.CreditNotes.Queries.ListCreditNotes;

public sealed record CreditNoteItemDto(
    Guid Id,
    int LineNumber,
    string ItemCode,
    string? AdditionalCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Subtotal,
    string VatPercentageCode,
    decimal VatRate,
    decimal VatAmount,
    decimal Total,
    Guid? WarehouseId);

public sealed record CreditNoteDto(
    Guid Id,
    string DocumentNumber,
    string AccessKey,
    DateOnly IssueDate,
    CreditNoteStatus Status,
    CreditNoteReasonType ReasonType,
    string Reason,
    string ModifiedDocumentType,
    string ModifiedDocumentNumber,
    DateOnly ModifiedDocumentIssueDate,
    string BuyerIdentificationType,
    string BuyerIdentification,
    string BuyerName,
    string BuyerAddress,
    string? BuyerEmail,
    decimal SubtotalWithoutTaxes,
    decimal VatAmount,
    decimal ModificationValue,
    string Environment,
    string? AuthorizationNumber,
    DateTimeOffset? AuthorizationDate,
    string? SriMessages,
    int ItemsCount,
    DateTimeOffset CreatedAt);

public sealed record CreditNoteKpisDto(
    int TotalCount,
    int AuthorizedCount,
    int DraftCount,
    decimal TotalModifiedValue,
    int MerchandiseReturnsCount);

public sealed record ListCreditNotesQuery(
    Guid TenantId,
    CreditNoteStatus? Status = null,
    CreditNoteReasonType? ReasonType = null,
    DateOnly? StartDate = null,
    DateOnly? EndDate = null,
    string? SearchTerm = null,
    int PageNumber = 1,
    int PageSize = 20) : IQuery<ListCreditNotesResponse>;

public sealed record ListCreditNotesResponse(
    IReadOnlyList<CreditNoteDto> Items,
    int TotalCount,
    int PageNumber,
    int PageSize,
    CreditNoteKpisDto Kpis);

public sealed class ListCreditNotesHandler : IQueryHandler<ListCreditNotesQuery, ListCreditNotesResponse>
{
    private readonly ICreditNoteRepository _repository;

    public ListCreditNotesHandler(ICreditNoteRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<ListCreditNotesResponse>> Handle(ListCreditNotesQuery query, CancellationToken ct = default)
    {
        if (query.TenantId == Guid.Empty)
        {
            return Result.Failure<ListCreditNotesResponse>(new Error("credit_note.tenant_id.empty", "El tenantId es obligatorio.", ErrorType.Validation));
        }

        var (items, totalCount) = await _repository.ListAsync(
            query.TenantId,
            query.Status,
            query.ReasonType,
            query.StartDate,
            query.EndDate,
            query.SearchTerm,
            query.PageNumber,
            query.PageSize,
            ct).ConfigureAwait(false);

        var dtos = items.Select(c => new CreditNoteDto(
            Id: c.Id,
            DocumentNumber: c.DocumentNumber,
            AccessKey: c.AccessKey,
            IssueDate: c.IssueDate,
            Status: c.Status,
            ReasonType: c.ReasonType,
            Reason: c.Reason,
            ModifiedDocumentType: c.ModifiedDocumentType,
            ModifiedDocumentNumber: c.ModifiedDocumentNumber,
            ModifiedDocumentIssueDate: c.ModifiedDocumentIssueDate,
            BuyerIdentificationType: c.BuyerIdentificationType,
            BuyerIdentification: c.BuyerIdentification,
            BuyerName: c.BuyerName,
            BuyerAddress: c.BuyerAddress,
            BuyerEmail: c.BuyerEmail,
            SubtotalWithoutTaxes: c.SubtotalWithoutTaxes,
            VatAmount: c.VatAmount,
            ModificationValue: c.ModificationValue,
            Environment: c.Environment,
            AuthorizationNumber: c.AuthorizationNumber,
            AuthorizationDate: c.AuthorizationDate,
            SriMessages: c.SriMessages,
            ItemsCount: c.Items.Count,
            CreatedAt: c.CreatedAt
        )).ToList();

        // Cómputo de KPIs para la cabecera M3
        var kpis = new CreditNoteKpisDto(
            TotalCount: totalCount,
            AuthorizedCount: items.Count(i => i.Status == CreditNoteStatus.Authorized),
            DraftCount: items.Count(i => i.Status == CreditNoteStatus.Draft),
            TotalModifiedValue: items.Sum(i => i.ModificationValue),
            MerchandiseReturnsCount: items.Count(i => i.ReasonType == CreditNoteReasonType.MerchandiseReturn)
        );

        var response = new ListCreditNotesResponse(
            Items: dtos,
            TotalCount: totalCount,
            PageNumber: Math.Max(1, query.PageNumber),
            PageSize: Math.Max(1, query.PageSize),
            Kpis: kpis
        );

        return Result.Success(response);
    }
}
