using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Warehousing.Queries.ListWarehouses;

public sealed record ListWarehousesQuery(Guid TenantId) : IQuery<IReadOnlyList<WarehouseListItemResponse>>;

public sealed record WarehouseListItemResponse(
    Guid Id,
    string Name,
    string? Code,
    bool IsMain,
    bool IsSystem,
    int SystemRole,
    DateTimeOffset CreatedAt);
