using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Queries.ListJournalEntries;

public sealed record ListJournalEntriesQuery(
    Guid TenantId,
    DateOnly? From = null,
    DateOnly? To = null,
    JournalEntrySource? Source = null,
    JournalEntryStatus? Status = null,
    string? Search = null) : IQuery<ListJournalEntriesResponse>;

public sealed class ListJournalEntriesHandler : IQueryHandler<ListJournalEntriesQuery, ListJournalEntriesResponse>
{
    private readonly IJournalEntryRepository _journalEntries;

    public ListJournalEntriesHandler(IJournalEntryRepository journalEntries)
    {
        _journalEntries = journalEntries;
    }

    public async Task<Result<ListJournalEntriesResponse>> Handle(
        ListJournalEntriesQuery query,
        CancellationToken ct)
    {
        var entries = await _journalEntries.ListAsync(
            tenantId: query.TenantId,
            from: query.From,
            to: query.To,
            source: query.Source,
            status: query.Status,
            search: query.Search,
            ct: ct).ConfigureAwait(false);

        var total = entries.Count;
        var posted = entries.Count(e => e.Status == JournalEntryStatus.Posted);
        var draft = entries.Count(e => e.Status == JournalEntryStatus.Draft);
        var totalDebitVolume = entries.Where(e => e.Status == JournalEntryStatus.Posted).Sum(e => e.TotalDebit);

        var kpis = new ListJournalEntriesKpisDto(
            TotalEntries: total,
            TotalPosted: posted,
            TotalDraft: draft,
            TotalDebitVolume: Math.Round(totalDebitVolume, 2, MidpointRounding.AwayFromZero)
        );

        var dtos = entries.Select(e => new JournalEntrySummaryDto(
            Id: e.Id,
            TenantId: e.TenantId,
            EntryNumber: e.EntryNumber,
            Date: e.Date,
            Description: e.Description,
            Status: e.Status,
            Source: e.Source,
            SourceId: e.SourceId,
            SourceReference: e.SourceReference,
            TotalDebit: e.TotalDebit,
            TotalCredit: e.TotalCredit,
            IsBalanced: e.IsBalanced,
            LinesCount: e.Lines.Count,
            CreatedAt: e.CreatedAt
        )).ToList();

        return Result.Success(new ListJournalEntriesResponse(kpis, dtos.AsReadOnly()));
    }
}
