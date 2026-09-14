using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting.Repositories;

public interface IJournalEntryRepository
{
    Task AddAsync(JournalEntry entry, CancellationToken ct);
    Task<JournalEntry?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct);
    Task<JournalEntry?> GetTrackedByIdAsync(Guid tenantId, Guid id, CancellationToken ct);
    Task<JournalEntry?> GetBySourceAsync(Guid tenantId, JournalEntrySource source, Guid sourceId, CancellationToken ct);
    Task<IReadOnlyList<JournalEntry>> ListAsync(
        Guid tenantId,
        DateOnly? from,
        DateOnly? to,
        JournalEntrySource? source,
        JournalEntryStatus? status,
        string? search,
        CancellationToken ct);
    Task<string> GetNextEntryNumberAsync(Guid tenantId, int year, CancellationToken ct);
    Task<int> CountAsync(Guid tenantId, CancellationToken ct);
}
