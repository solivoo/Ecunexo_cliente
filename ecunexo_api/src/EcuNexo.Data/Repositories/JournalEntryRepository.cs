using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Accounting;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class JournalEntryRepository : IJournalEntryRepository
{
    private readonly EcuNexoDbContext _db;

    public JournalEntryRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(JournalEntry entry, CancellationToken ct)
    {
        _db.JournalEntries.Add(entry);
        return Task.CompletedTask;
    }

    public Task<JournalEntry?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct) =>
        _db.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantId && j.Id == id, ct);

    public Task<JournalEntry?> GetTrackedByIdAsync(Guid tenantId, Guid id, CancellationToken ct) =>
        _db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantId && j.Id == id, ct);

    public Task<JournalEntry?> GetBySourceAsync(Guid tenantId, JournalEntrySource source, Guid sourceId, CancellationToken ct) =>
        _db.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantId && j.Source == source && j.SourceId == sourceId, ct);

    public async Task<IReadOnlyList<JournalEntry>> ListAsync(
        Guid tenantId,
        DateOnly? from,
        DateOnly? to,
        JournalEntrySource? source,
        JournalEntryStatus? status,
        string? search,
        CancellationToken ct)
    {
        var query = _db.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .Where(j => j.TenantId == tenantId);

        if (from.HasValue)
        {
            query = query.Where(j => j.Date >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(j => j.Date <= to.Value);
        }

        if (source.HasValue)
        {
            query = query.Where(j => j.Source == source.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(j => j.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(j =>
                EF.Functions.ILike(j.EntryNumber, pattern) ||
                EF.Functions.ILike(j.Description, pattern) ||
                (j.SourceReference != null && EF.Functions.ILike(j.SourceReference, pattern)));
        }

        return await query
            .OrderByDescending(j => j.Date)
            .ThenByDescending(j => j.EntryNumber)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<string> GetNextEntryNumberAsync(Guid tenantId, int year, CancellationToken ct)
    {
        var prefix = $"AS-{year}-";
        var countInYear = await _db.JournalEntries
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.EntryNumber.StartsWith(prefix))
            .CountAsync(ct)
            .ConfigureAwait(false);

        var nextSeq = countInYear + 1;
        return $"{prefix}{nextSeq:D6}";
    }

    public Task<int> CountAsync(Guid tenantId, CancellationToken ct) =>
        _db.JournalEntries.AsNoTracking().CountAsync(j => j.TenantId == tenantId, ct);
}
