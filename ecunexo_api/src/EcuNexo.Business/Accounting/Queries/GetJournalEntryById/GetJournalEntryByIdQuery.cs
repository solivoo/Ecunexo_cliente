using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Queries.GetJournalEntryById;

public sealed record GetJournalEntryByIdQuery(
    Guid TenantId,
    Guid Id) : IQuery<JournalEntryResponse>;

public sealed class GetJournalEntryByIdHandler : IQueryHandler<GetJournalEntryByIdQuery, JournalEntryResponse>
{
    private readonly IJournalEntryRepository _journalEntries;

    public GetJournalEntryByIdHandler(IJournalEntryRepository journalEntries)
    {
        _journalEntries = journalEntries;
    }

    public async Task<Result<JournalEntryResponse>> Handle(
        GetJournalEntryByIdQuery query,
        CancellationToken ct)
    {
        var entry = await _journalEntries.GetByIdAsync(query.TenantId, query.Id, ct).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<JournalEntryResponse>(
                new Error("journal_entry.not_found", "El asiento contable solicitado no existe o no pertenece a la empresa.", ErrorType.NotFound));
        }

        return Result.Success(JournalEntryResponse.FromDomain(entry));
    }
}
