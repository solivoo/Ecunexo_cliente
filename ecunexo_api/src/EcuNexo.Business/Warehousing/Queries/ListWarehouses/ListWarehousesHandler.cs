using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Warehousing.Queries.ListWarehouses;

public sealed class ListWarehousesHandler
    : IQueryHandler<ListWarehousesQuery, IReadOnlyList<WarehouseListItemResponse>>
{
    private readonly IWarehouseRepository _warehouses;
    private readonly DefaultWarehouseProvisioner _defaults;

    public ListWarehousesHandler(IWarehouseRepository warehouses, DefaultWarehouseProvisioner defaults)
    {
        _warehouses = warehouses;
        _defaults = defaults;
    }

    public async Task<Result<IReadOnlyList<WarehouseListItemResponse>>> Handle(
        ListWarehousesQuery query,
        CancellationToken ct)
    {
        await _defaults.EnsureAsync(query.TenantId, ct).ConfigureAwait(false);
        var list = await _warehouses.ListActiveByTenantAsync(query.TenantId, ct).ConfigureAwait(false);
        IReadOnlyList<WarehouseListItemResponse> items = list
            .Select(w => new WarehouseListItemResponse(
                w.Id,
                w.Name,
                w.Code,
                w.IsMain,
                w.IsSystem,
                (int)w.SystemRole,
                w.CreatedAt))
            .ToList();
        return Result.Success(items);
    }
}
