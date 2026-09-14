using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting;

public sealed record JournalEntryLineResponse(
    Guid Id,
    Guid AccountId,
    string AccountCode,
    string AccountName,
    decimal Debit,
    decimal Credit,
    string? Reference);

public sealed record JournalEntrySummaryDto(
    Guid Id,
    Guid TenantId,
    string EntryNumber,
    DateOnly Date,
    string Description,
    JournalEntryStatus Status,
    JournalEntrySource Source,
    Guid? SourceId,
    string? SourceReference,
    decimal TotalDebit,
    decimal TotalCredit,
    bool IsBalanced,
    int LinesCount,
    DateTimeOffset CreatedAt);

public sealed record ListJournalEntriesKpisDto(
    int TotalEntries,
    int TotalPosted,
    int TotalDraft,
    decimal TotalDebitVolume);

public sealed record ListJournalEntriesResponse(
    ListJournalEntriesKpisDto Kpis,
    IReadOnlyList<JournalEntrySummaryDto> Entries);

public sealed record JournalEntryResponse(
    Guid Id,
    Guid TenantId,
    string EntryNumber,
    DateOnly Date,
    string Description,
    JournalEntryStatus Status,
    JournalEntrySource Source,
    Guid? SourceId,
    string? SourceReference,
    decimal TotalDebit,
    decimal TotalCredit,
    bool IsBalanced,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyList<JournalEntryLineResponse> Lines)
{
    public static JournalEntryResponse FromDomain(JournalEntry entry) =>
        new(
            entry.Id,
            entry.TenantId,
            entry.EntryNumber,
            entry.Date,
            entry.Description,
            entry.Status,
            entry.Source,
            entry.SourceId,
            entry.SourceReference,
            entry.TotalDebit,
            entry.TotalCredit,
            entry.IsBalanced,
            entry.CreatedAt,
            entry.UpdatedAt,
            entry.Lines
                .Select(l => new JournalEntryLineResponse(
                    l.Id,
                    l.AccountId,
                    l.AccountCode,
                    l.AccountName,
                    l.Debit,
                    l.Credit,
                    l.Reference))
                .ToList());
}
