using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Ecommerce.Repositories;

public sealed record EcommerceOrderMetrics(
    int TotalOrders,
    int PendingCount,
    int ProcessingCount,
    int ShippedCount,
    int DeliveredCount,
    int CancelledCount,
    decimal TotalSalesAmount);

public interface IEcommerceOrderRepository
{
    Task AddAsync(EcommerceOrder order, CancellationToken ct = default);

    Task<EcommerceOrder?> GetByIdAsync(Guid tenantId, Guid orderId, CancellationToken ct = default);

    Task<EcommerceOrder?> GetTrackedWithDetailsAsync(Guid tenantId, Guid orderId, CancellationToken ct = default);

    Task<(IReadOnlyList<EcommerceOrder> Items, int TotalCount)> ListAsync(
        Guid tenantId,
        EcommerceOrderStatus? status,
        EcommercePaymentStatus? paymentStatus,
        string? search,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int pageNumber,
        int pageSize,
        CancellationToken ct = default);

    Task<EcommerceOrderMetrics> GetMetricsAsync(Guid tenantId, CancellationToken ct = default);

    Task<string> GenerateNextOrderNumberAsync(Guid tenantId, CancellationToken ct = default);
}
