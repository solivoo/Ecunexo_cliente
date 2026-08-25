using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Warehousing.Queries.GetWarehouse;

public sealed record GetWarehouseQuery(Guid TenantId, Guid WarehouseId) : IQuery<WarehouseDetailResponse>;

public sealed record WarehouseDetailResponse(
    Guid Id,
    string Name,
    string? Code,
    string AddressJson,
    bool IsMain,
    bool IsSystem,
    int SystemRole,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
