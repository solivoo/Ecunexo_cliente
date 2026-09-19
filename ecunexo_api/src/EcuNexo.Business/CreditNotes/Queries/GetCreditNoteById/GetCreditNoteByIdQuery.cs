using EcuNexo.Business.Abstractions;
using EcuNexo.Business.CreditNotes.Commands.CreateCreditNote;
using EcuNexo.Business.CreditNotes.Queries.ListCreditNotes;
using EcuNexo.Core.Common;
using EcuNexo.Core.CreditNotes;

namespace EcuNexo.Business.CreditNotes.Queries.GetCreditNoteById;

public sealed record CreditNoteDetailDto(
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
    string? ModifiedDocumentAuthorizationNumber,
    Guid? ModifiedDocumentId,
    string BuyerIdentificationType,
    string BuyerIdentification,
    string BuyerName,
    string BuyerAddress,
    string? BuyerEmail,
    decimal SubtotalWithoutTaxes,
    decimal TotalDiscount,
    decimal SubtotalVat15,
    decimal SubtotalVat13,
    decimal SubtotalVat12,
    decimal SubtotalVat0,
    decimal SubtotalNoVat,
    decimal SubtotalExemptVat,
    decimal VatAmount,
    decimal ModificationValue,
    string Environment,
    string? AuthorizationNumber,
    DateTimeOffset? AuthorizationDate,
    string? SriMessages,
    string? XmlContent,
    IReadOnlyList<CreditNoteItemDto> Items,
    IReadOnlyList<CreditNoteAdditionalFieldInput> AdditionalFields,
    DateTimeOffset CreatedAt);

public sealed record GetCreditNoteByIdQuery(
    Guid TenantId,
    Guid CreditNoteId) : IQuery<CreditNoteDetailDto>;

public sealed class GetCreditNoteByIdHandler : IQueryHandler<GetCreditNoteByIdQuery, CreditNoteDetailDto>
{
    private readonly ICreditNoteRepository _repository;

    public GetCreditNoteByIdHandler(ICreditNoteRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<CreditNoteDetailDto>> Handle(GetCreditNoteByIdQuery query, CancellationToken ct = default)
    {
        if (query.TenantId == Guid.Empty)
        {
            return Result.Failure<CreditNoteDetailDto>(new Error("credit_note.tenant_id.empty", "El tenantId es obligatorio.", ErrorType.Validation));
        }

        if (query.CreditNoteId == Guid.Empty)
        {
            return Result.Failure<CreditNoteDetailDto>(new Error("credit_note.id.empty", "El ID de la Nota de Crédito es obligatorio.", ErrorType.Validation));
        }

        var creditNote = await _repository.GetByIdAsync(query.TenantId, query.CreditNoteId, ct).ConfigureAwait(false);
        if (creditNote is null)
        {
            return Result.Failure<CreditNoteDetailDto>(new Error("credit_note.not_found", "La Nota de Crédito no existe.", ErrorType.NotFound));
        }

        var itemDtos = creditNote.Items.Select(i => new CreditNoteItemDto(
            Id: i.Id,
            LineNumber: i.LineNumber,
            ItemCode: i.ItemCode,
            AdditionalCode: i.AdditionalCode,
            Description: i.Description,
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            Discount: i.Discount,
            Subtotal: i.Subtotal,
            VatPercentageCode: i.VatPercentageCode,
            VatRate: i.VatRate,
            VatAmount: i.VatAmount,
            Total: i.Total,
            WarehouseId: i.WarehouseId
        )).ToList();

        var addFieldDtos = creditNote.AdditionalFields
            .Select(f => new CreditNoteAdditionalFieldInput(f.Name, f.Value))
            .ToList();

        var dto = new CreditNoteDetailDto(
            Id: creditNote.Id,
            DocumentNumber: creditNote.DocumentNumber,
            AccessKey: creditNote.AccessKey,
            IssueDate: creditNote.IssueDate,
            Status: creditNote.Status,
            ReasonType: creditNote.ReasonType,
            Reason: creditNote.Reason,
            ModifiedDocumentType: creditNote.ModifiedDocumentType,
            ModifiedDocumentNumber: creditNote.ModifiedDocumentNumber,
            ModifiedDocumentIssueDate: creditNote.ModifiedDocumentIssueDate,
            ModifiedDocumentAuthorizationNumber: creditNote.ModifiedDocumentAuthorizationNumber,
            ModifiedDocumentId: creditNote.ModifiedDocumentId,
            BuyerIdentificationType: creditNote.BuyerIdentificationType,
            BuyerIdentification: creditNote.BuyerIdentification,
            BuyerName: creditNote.BuyerName,
            BuyerAddress: creditNote.BuyerAddress,
            BuyerEmail: creditNote.BuyerEmail,
            SubtotalWithoutTaxes: creditNote.SubtotalWithoutTaxes,
            TotalDiscount: creditNote.TotalDiscount,
            SubtotalVat15: creditNote.SubtotalVat15,
            SubtotalVat13: creditNote.SubtotalVat13,
            SubtotalVat12: creditNote.SubtotalVat12,
            SubtotalVat0: creditNote.SubtotalVat0,
            SubtotalNoVat: creditNote.SubtotalNoVat,
            SubtotalExemptVat: creditNote.SubtotalExemptVat,
            VatAmount: creditNote.VatAmount,
            ModificationValue: creditNote.ModificationValue,
            Environment: creditNote.Environment,
            AuthorizationNumber: creditNote.AuthorizationNumber,
            AuthorizationDate: creditNote.AuthorizationDate,
            SriMessages: creditNote.SriMessages,
            XmlContent: creditNote.XmlContent,
            Items: itemDtos,
            AdditionalFields: addFieldDtos,
            CreatedAt: creditNote.CreatedAt
        );

        return Result.Success(dto);
    }
}
