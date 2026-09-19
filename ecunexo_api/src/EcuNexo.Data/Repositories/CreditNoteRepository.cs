using EcuNexo.Core.CreditNotes;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class CreditNoteRepository : ICreditNoteRepository
{
    private readonly EcuNexoDbContext _db;

    public CreditNoteRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(CreditNote creditNote, CancellationToken cancellationToken = default)
    {
        _db.CreditNotes.Add(creditNote);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(CreditNote creditNote, CancellationToken cancellationToken = default)
    {
        _db.CreditNotes.Update(creditNote);
        return Task.CompletedTask;
    }

    public Task<CreditNote?> GetByIdAsync(Guid tenantId, Guid creditNoteId, CancellationToken cancellationToken = default)
    {
        return _db.CreditNotes
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == creditNoteId && c.DeletedAt == null, cancellationToken);
    }

    public Task<CreditNote?> GetByDocumentNumberAsync(Guid tenantId, string establishment, string emissionPoint, string sequential, CancellationToken cancellationToken = default)
    {
        var cleanEstab = establishment.Trim().PadLeft(3, '0');
        var cleanPto = emissionPoint.Trim().PadLeft(3, '0');
        var cleanSeq = sequential.Trim().PadLeft(9, '0');

        return _db.CreditNotes
            .Include(c => c.Items)
            .FirstOrDefaultAsync(
                c => c.TenantId == tenantId
                     && c.Establishment == cleanEstab
                     && c.EmissionPoint == cleanPto
                     && c.Sequential == cleanSeq
                     && c.DeletedAt == null,
                cancellationToken);
    }

    public Task<CreditNote?> GetByAccessKeyAsync(Guid tenantId, string accessKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(accessKey))
        {
            return Task.FromResult<CreditNote?>(null);
        }

        var cleanKey = accessKey.Trim();
        return _db.CreditNotes
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.AccessKey == cleanKey && c.DeletedAt == null, cancellationToken);
    }

    public async Task<(IReadOnlyCollection<CreditNote> Items, int TotalCount)> ListAsync(
        Guid tenantId,
        CreditNoteStatus? status = null,
        CreditNoteReasonType? reasonType = null,
        DateOnly? startDate = null,
        DateOnly? endDate = null,
        string? searchTerm = null,
        int pageNumber = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _db.CreditNotes
            .Include(c => c.Items)
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (status.HasValue)
        {
            query = query.Where(c => c.Status == status.Value);
        }

        if (reasonType.HasValue)
        {
            query = query.Where(c => c.ReasonType == reasonType.Value);
        }

        if (startDate.HasValue)
        {
            query = query.Where(c => c.IssueDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(c => c.IssueDate <= endDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var pattern = $"%{searchTerm.Trim()}%";
            query = query.Where(c =>
                EF.Functions.ILike(c.Establishment, pattern)
                || EF.Functions.ILike(c.EmissionPoint, pattern)
                || EF.Functions.ILike(c.Sequential, pattern)
                || EF.Functions.ILike(c.BuyerName, pattern)
                || EF.Functions.ILike(c.BuyerIdentification, pattern)
                || EF.Functions.ILike(c.ModifiedDocumentNumber, pattern)
                || EF.Functions.ILike(c.Reason, pattern)
                || EF.Functions.ILike(c.AccessKey, pattern));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var items = await query
            .OrderByDescending(c => c.IssueDate)
            .ThenByDescending(c => c.CreatedAt)
            .Skip((Math.Max(1, pageNumber) - 1) * Math.Max(1, pageSize))
            .Take(Math.Max(1, pageSize))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return (items, totalCount);
    }

    public async Task<string> AllocateNextSequentialAsync(
        Guid tenantId,
        string establishment,
        string emissionPoint,
        string environment = "1",
        CancellationToken cancellationToken = default)
    {
        var cleanEstab = establishment.Trim().PadLeft(3, '0');
        var cleanPto = emissionPoint.Trim().PadLeft(3, '0');
        var cleanEnv = environment == "2" ? "2" : "1";

        var maxSeq = await _db.CreditNotes
            .Where(c => c.TenantId == tenantId
                        && c.Establishment == cleanEstab
                        && c.EmissionPoint == cleanPto
                        && c.Environment == cleanEnv
                        && c.DeletedAt == null)
            .Select(c => c.Sequential)
            .OrderByDescending(s => s)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (string.IsNullOrWhiteSpace(maxSeq) || !long.TryParse(maxSeq, out var currentVal))
        {
            return "000000001";
        }

        var nextVal = currentVal + 1;
        return nextVal.ToString("D9", System.Globalization.CultureInfo.InvariantCulture);
    }
}
