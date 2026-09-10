using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Repairs.Repositories;
using EcuNexo.Core.Common;
using EcuNexo.Core.Repairs;

namespace EcuNexo.Business.Repairs.Queries.ListBatches;

public sealed record BatchListItemResponse(
    Guid Id,
    string BatchNumber,
    Guid CustomerId,
    string CustomerName,
    RepairBatchStatus Status,
    int TotalCount,
    int ReceivedCount,
    int InRepairCount,
    int ReadyCount,
    int DispatchedCount,
    double ProgressPercentage,
    DateTimeOffset ReceivedAt,
    DateTimeOffset? ExpectedCompletionAt);

public sealed record ListBatchesQuery(
    Guid TenantId,
    Guid? CustomerId = null,
    RepairBatchStatus? Status = null) : IQuery<IReadOnlyList<BatchListItemResponse>>;

public sealed class ListBatchesHandler : IQueryHandler<ListBatchesQuery, IReadOnlyList<BatchListItemResponse>>
{
    private readonly IRepairBatchRepository _batchRepository;

    public ListBatchesHandler(IRepairBatchRepository batchRepository)
    {
        _batchRepository = batchRepository;
    }

    public async Task<Result<IReadOnlyList<BatchListItemResponse>>> Handle(ListBatchesQuery query, CancellationToken ct)
    {
        var batches = await _batchRepository.ListByTenantAsync(query.TenantId, query.CustomerId, query.Status, ct).ConfigureAwait(false);

        var response = batches.Select(b =>
        {
            var progress = b.TotalCount > 0
                ? Math.Round((double)(b.DispatchedCount + b.ReadyCount) / b.TotalCount * 100, 1)
                : 0.0;

            return new BatchListItemResponse(
                Id: b.Id,
                BatchNumber: b.BatchNumber,
                CustomerId: b.CustomerId,
                CustomerName: b.Customer?.Name ?? "Sin Asignar",
                Status: b.Status,
                TotalCount: b.TotalCount,
                ReceivedCount: b.ReceivedCount,
                InRepairCount: b.InRepairCount,
                ReadyCount: b.ReadyCount,
                DispatchedCount: b.DispatchedCount,
                ProgressPercentage: progress,
                ReceivedAt: b.ReceivedAt,
                ExpectedCompletionAt: b.ExpectedCompletionAt);
        }).ToList();

        return response;
    }
}
