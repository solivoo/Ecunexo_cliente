using EcuNexo.Business.RemisionGuides;
using EcuNexo.Core.RemisionGuides;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class RemisionGuideRepository : IRemisionGuideRepository
{
    private readonly EcuNexoDbContext _db;

    public RemisionGuideRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(RemisionGuide guide, CancellationToken ct = default)
    {
        _db.RemisionGuides.Add(guide);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(RemisionGuide guide, CancellationToken ct = default)
    {
        _db.RemisionGuides.Update(guide);
        return Task.CompletedTask;
    }

    public Task<RemisionGuide?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default) =>
        _db.RemisionGuides
            .Include(g => g.Items)
            .FirstOrDefaultAsync(g => g.TenantId == tenantId && g.Id == id && g.DeletedAt == null, ct);

    public Task<bool> ExistsSequentialAsync(
        Guid tenantId,
        string establishment,
        string emissionPoint,
        string sequential,
        Guid? excludeId = null,
        CancellationToken ct = default)
    {
        var cleanEstab = establishment.Trim().PadLeft(3, '0');
        var cleanPto = emissionPoint.Trim().PadLeft(3, '0');
        var cleanSeq = sequential.Trim().PadLeft(9, '0');

        return _db.RemisionGuides.AnyAsync(
            g => g.TenantId == tenantId
                 && g.Establishment == cleanEstab
                 && g.EmissionPoint == cleanPto
                 && g.Sequential == cleanSeq
                 && (excludeId == null || g.Id != excludeId.Value)
                 && g.DeletedAt == null,
            ct);
    }

    public async Task<string> GetNextSequentialAsync(
        Guid tenantId,
        string establishment,
        string emissionPoint,
        CancellationToken ct = default)
    {
        var cleanEstab = establishment.Trim().PadLeft(3, '0');
        var cleanPto = emissionPoint.Trim().PadLeft(3, '0');

        var maxSeq = await _db.RemisionGuides
            .Where(g => g.TenantId == tenantId
                        && g.Establishment == cleanEstab
                        && g.EmissionPoint == cleanPto
                        && g.DeletedAt == null)
            .Select(g => g.Sequential)
            .OrderByDescending(s => s)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        if (string.IsNullOrWhiteSpace(maxSeq) || !long.TryParse(maxSeq, out var currentVal))
        {
            return "000000001";
        }

        var nextVal = currentVal + 1;
        return nextVal.ToString("D9", System.Globalization.CultureInfo.InvariantCulture);
    }

    public async Task<IReadOnlyList<RemisionGuide>> ListAsync(
        Guid tenantId,
        RemisionGuideStatus? status = null,
        DateOnly? from = null,
        DateOnly? to = null,
        string? search = null,
        CancellationToken ct = default)
    {
        var query = _db.RemisionGuides
            .Include(g => g.Items)
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null);

        if (status.HasValue)
        {
            query = query.Where(g => g.Status == status.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(g => g.IssueDate >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(g => g.IssueDate <= to.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(g =>
                EF.Functions.ILike(g.Establishment, pattern)
                || EF.Functions.ILike(g.EmissionPoint, pattern)
                || EF.Functions.ILike(g.Sequential, pattern)
                || EF.Functions.ILike(g.CarrierName, pattern)
                || EF.Functions.ILike(g.CarrierIdentification, pattern)
                || EF.Functions.ILike(g.LicensePlate, pattern)
                || EF.Functions.ILike(g.RecipientName, pattern)
                || EF.Functions.ILike(g.RecipientIdentification, pattern)
                || EF.Functions.ILike(g.RouteDescription, pattern)
                || EF.Functions.ILike(g.AccessKey, pattern));
        }

        var list = await query
            .OrderByDescending(g => g.IssueDate)
            .ThenByDescending(g => g.CreatedAt)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return list;
    }
}
