using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Ecommerce;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class EcommerceOrderRepository : IEcommerceOrderRepository
{
    private readonly EcuNexoDbContext _db;

    public EcommerceOrderRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(EcommerceOrder order, CancellationToken ct = default)
    {
        _db.EcommerceOrders.Add(order);
        return Task.CompletedTask;
    }

    public Task<EcommerceOrder?> GetByIdAsync(Guid tenantId, Guid orderId, CancellationToken ct = default) =>
        _db.EcommerceOrders.AsNoTracking()
            .Include(o => o.Warehouse)
            .Include(o => o.Items)
                .ThenInclude(i => i.CatalogItem)
            .Include(o => o.Timeline)
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Id == orderId, ct);

    public Task<EcommerceOrder?> GetTrackedWithDetailsAsync(Guid tenantId, Guid orderId, CancellationToken ct = default) =>
        _db.EcommerceOrders
            .Include(o => o.Items)
            .Include(o => o.Timeline)
            .FirstOrDefaultAsync(o => o.TenantId == tenantId && o.Id == orderId, ct);

    public Task<EcommerceOrder?> FindByClientRequestIdAsync(
        Guid tenantId,
        string requestId,
        CancellationToken ct = default)
    {
        var normalized = requestId.Trim();
        return _db.EcommerceOrders.AsNoTracking()
            .FirstOrDefaultAsync(
                o => o.TenantId == tenantId && o.ClientRequestId == normalized,
                ct);
    }

    public async Task<int> CountPendingByContactAsync(
        Guid tenantId,
        string emailNormalized,
        string phoneDigits,
        CancellationToken ct = default)
    {
        var emailPattern = EscapeLikePattern(emailNormalized.Trim());
        var phone = phoneDigits.Trim();

        if (emailPattern.Length == 0 && phone.Length == 0)
        {
            return 0;
        }

        var query = _db.EcommerceOrders.AsNoTracking()
            .Where(o => o.TenantId == tenantId
                && o.Status == EcommerceOrderStatus.Placed
                && o.PaymentStatus == EcommercePaymentStatus.Pending);

        if (emailPattern.Length > 0 && phone.Length > 0)
        {
            query = query.Where(o =>
                EF.Functions.ILike(o.Customer.Email, emailPattern)
                || (o.Customer.Phone != null
                    && o.Customer.Phone.Replace(" ", string.Empty)
                        .Replace("+", string.Empty)
                        .Replace("-", string.Empty)
                        .Replace("(", string.Empty)
                        .Replace(")", string.Empty) == phone));
        }
        else if (emailPattern.Length > 0)
        {
            query = query.Where(o => EF.Functions.ILike(o.Customer.Email, emailPattern));
        }
        else
        {
            query = query.Where(o =>
                o.Customer.Phone != null
                && o.Customer.Phone.Replace(" ", string.Empty)
                    .Replace("+", string.Empty)
                    .Replace("-", string.Empty)
                    .Replace("(", string.Empty)
                    .Replace(")", string.Empty) == phone);
        }

        return await query.CountAsync(ct).ConfigureAwait(false);
    }

    private static string EscapeLikePattern(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    public async Task<IReadOnlyList<EcommerceOrder>> ListPendingPaymentBeforeAsync(
        DateTimeOffset threshold,
        int limit,
        CancellationToken ct = default)
    {
        var take = limit > 0 ? limit : 50;

        return await _db.EcommerceOrders.AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.Status == EcommerceOrderStatus.Placed
                && o.PaymentStatus == EcommercePaymentStatus.Pending
                && o.OrderDate < threshold)
            .OrderBy(o => o.OrderDate)
            .Take(take)
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }

    public async Task<(IReadOnlyList<EcommerceOrder> Items, int TotalCount)> ListAsync(
        Guid tenantId,
        EcommerceOrderStatus? status,
        EcommercePaymentStatus? paymentStatus,
        string? search,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int pageNumber,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = _db.EcommerceOrders.AsNoTracking()
            .Include(o => o.Warehouse)
            .Include(o => o.Items)
            .Where(o => o.TenantId == tenantId);

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        if (paymentStatus.HasValue)
        {
            query = query.Where(o => o.PaymentStatus == paymentStatus.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(o => o.OrderDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(o => o.OrderDate <= toDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().ToLowerInvariant()}%";
            query = query.Where(o =>
                EF.Functions.ILike(o.OrderNumber, pattern)
                || EF.Functions.ILike(o.Customer.CustomerName, pattern)
                || EF.Functions.ILike(o.Customer.TaxId, pattern)
                || EF.Functions.ILike(o.Customer.Email, pattern)
                || EF.Functions.ILike(o.Shipping.RecipientName, pattern));
        }

        var totalCount = await query.CountAsync(ct).ConfigureAwait(false);

        var validPageNumber = pageNumber > 0 ? pageNumber : 1;
        var validPageSize = pageSize > 0 ? pageSize : 20;

        var items = await query
            .OrderByDescending(o => o.OrderDate)
            .Skip((validPageNumber - 1) * validPageSize)
            .Take(validPageSize)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return (items, totalCount);
    }

    public async Task<EcommerceOrderMetrics> GetMetricsAsync(
        Guid tenantId,
        DateTimeOffset? fromDate = null,
        DateTimeOffset? toDate = null,
        CancellationToken ct = default)
    {
        var query = _db.EcommerceOrders.AsNoTracking()
            .Where(o => o.TenantId == tenantId);

        if (fromDate.HasValue)
        {
            var from = fromDate.Value.ToUniversalTime();
            query = query.Where(o => o.OrderDate >= from);
        }

        if (toDate.HasValue)
        {
            var to = toDate.Value.ToUniversalTime();
            query = query.Where(o => o.OrderDate <= to);
        }

        var orders = await query
            .Select(o => new { o.Status, o.TotalAmount })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        var totalOrders = orders.Count;
        var pendingCount = orders.Count(o => o.Status == EcommerceOrderStatus.Placed);
        var processingCount = orders.Count(o => o.Status == EcommerceOrderStatus.Confirmed || o.Status == EcommerceOrderStatus.Processing);
        var shippedCount = orders.Count(o => o.Status == EcommerceOrderStatus.Shipped);
        var deliveredCount = orders.Count(o => o.Status == EcommerceOrderStatus.Delivered);
        var cancelledCount = orders.Count(o => o.Status == EcommerceOrderStatus.Cancelled);
        var totalSales = orders.Where(o => o.Status != EcommerceOrderStatus.Cancelled).Sum(o => o.TotalAmount);

        return new EcommerceOrderMetrics(
            TotalOrders: totalOrders,
            PendingCount: pendingCount,
            ProcessingCount: processingCount,
            ShippedCount: shippedCount,
            DeliveredCount: deliveredCount,
            CancelledCount: cancelledCount,
            TotalSalesAmount: totalSales);
    }

    public async Task<string> GenerateNextOrderNumberAsync(Guid tenantId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var prefix = $"ECO-{now:yyyyMM}-";

        var lastOrderNumber = await _db.EcommerceOrders.AsNoTracking()
            .Where(o => o.TenantId == tenantId && o.OrderNumber.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNumber)
            .Select(o => o.OrderNumber)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        var nextSequence = 1;
        if (lastOrderNumber is not null && lastOrderNumber.Length > prefix.Length)
        {
            var suffix = lastOrderNumber[prefix.Length..];
            if (int.TryParse(suffix, out var parsed))
            {
                nextSequence = parsed + 1;
            }
        }

        return $"{prefix}{nextSequence:D4}";
    }
}
