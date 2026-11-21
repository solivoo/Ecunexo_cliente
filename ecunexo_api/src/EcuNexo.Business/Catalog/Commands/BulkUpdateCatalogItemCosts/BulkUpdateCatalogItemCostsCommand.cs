using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.BulkUpdateCatalogItemCosts;

public sealed record BulkCatalogItemCostEntry(Guid CatalogItemId, decimal? CostPrice);

public sealed record BulkUpdateCatalogItemCostsCommand(
    Guid TenantId,
    IReadOnlyList<BulkCatalogItemCostEntry> Items,
    Guid? UpdatedBy = null) : ICommand<BulkUpdateCatalogItemCostsResponse>;

public sealed record BulkUpdateCatalogItemCostsResponse(int UpdatedCount);

public sealed class BulkUpdateCatalogItemCostsHandler
    : ICommandHandler<BulkUpdateCatalogItemCostsCommand, BulkUpdateCatalogItemCostsResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public BulkUpdateCatalogItemCostsHandler(
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BulkUpdateCatalogItemCostsResponse>> Handle(
        BulkUpdateCatalogItemCostsCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty)
        {
            return Result.Failure<BulkUpdateCatalogItemCostsResponse>(
                new Error("catalog.item.tenant_empty", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (command.Items is null || command.Items.Count == 0)
        {
            return Result.Failure<BulkUpdateCatalogItemCostsResponse>(
                new Error("catalog.item.bulk_cost_empty", "Debe enviar al menos un producto.", ErrorType.Validation));
        }

        var count = 0;
        foreach (var entry in command.Items)
        {
            var item = await _items
                .GetTrackedByIdAsync(command.TenantId, entry.CatalogItemId, ct)
                .ConfigureAwait(false);
            if (item is null || item.DeletedAt.HasValue)
            {
                continue;
            }

            var setResult = item.SetCostPrice(entry.CostPrice, command.UpdatedBy);
            if (setResult.IsFailure)
            {
                return Result.Failure<BulkUpdateCatalogItemCostsResponse>(setResult.Error!);
            }

            count++;
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new BulkUpdateCatalogItemCostsResponse(count));
    }
}
