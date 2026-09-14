namespace EcuNexo.Api.Contracts.V1.Accounting;

public sealed record CreateJournalEntryLineRequest(
    Guid AccountId,
    decimal Debit,
    decimal Credit,
    string? Description = null);

public sealed record CreateJournalEntryRequest(
    DateOnly Date,
    string Description,
    IReadOnlyList<CreateJournalEntryLineRequest> Lines,
    bool AutoPost = true);
