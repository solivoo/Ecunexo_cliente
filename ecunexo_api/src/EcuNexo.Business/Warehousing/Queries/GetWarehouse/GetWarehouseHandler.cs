using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Warehousing.Queries.GetWarehouse;

public sealed class GetWarehouseHandler : IQueryHandler<GetWarehouseQuery, WarehouseDetailResponse>
{
    private readonly IWarehouseRepository _warehouses;

    public GetWarehouseHandler(IWarehouseRepository warehouses)
    {
        _warehouses = warehouses;
    }

    public async Task<Result<WarehouseDetailResponse>> Handle(GetWarehouseQuery query, CancellationToken ct)
    {
        var warehouse = await _warehouses
            .GetActiveByIdAsync(query.TenantId, query.WarehouseId, ct)
            .ConfigureAwait(false);
        if (warehouse is null)
        {
            return Result.Failure<WarehouseDetailResponse>(
                new Error("warehousing.warehouse.not_found", "La bodega no existe.", ErrorType.NotFound));
        }

        return Result.Success(
            new WarehouseDetailResponse(
                warehouse.Id,
                warehouse.Name,
                warehouse.Code,
                warehouse.AddressJson,
                warehouse.IsMain,
                warehouse.IsSystem,
                (int)warehouse.SystemRole,
                warehouse.CreatedAt,
                warehouse.UpdatedAt));
    }
}
