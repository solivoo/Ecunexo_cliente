using EcuNexo.Business.Ecommerce.Reservations;
using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class StockReservationRepository : IStockReservationRepository
{
    private readonly EcuNexoDbContext _db;

    public StockReservationRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<StockReservation>> ListAsync(
        Guid tenantId,
        StockReservationStatus? status,
        string? search,
        CancellationToken ct)
    {
        var query = _db.StockReservations
            .AsNoTracking()
            .Include(r => r.Items)
            .Include(r => r.Payments)
            .Include(r => r.Warehouse)
            .Where(r => r.TenantId == tenantId);

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                EF.Functions.ILike(r.ReservationNumber, $"%{term}%")
                || EF.Functions.ILike(r.CustomerName, $"%{term}%")
                || EF.Functions.ILike(r.CustomerTaxId, $"%{term}%"));
        }

        return await query
            .OrderByDescending(r => r.ReservedAtUtc)
            .Take(200)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public Task<StockReservation?> GetByIdWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct) =>
        _db.StockReservations
            .AsNoTracking()
            .Include(r => r.Items)
            .Include(r => r.Payments)
            .Include(r => r.Warehouse)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == reservationId, ct);

    public Task<StockReservation?> GetTrackedWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct) =>
        _db.StockReservations
            .Include(r => r.Items)
            .Include(r => r.Payments)
            .Include(r => r.Warehouse)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == reservationId, ct);

    public async Task<string> GenerateNextNumberAsync(Guid tenantId, CancellationToken ct)
    {
        var count = await _db.StockReservations
            .IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId, ct)
            .ConfigureAwait(false);
        return $"RES-{count + 1:00000}";
    }

    public Task AddAsync(StockReservation reservation, CancellationToken ct)
    {
        _db.StockReservations.Add(reservation);
        return Task.CompletedTask;
    }
}
