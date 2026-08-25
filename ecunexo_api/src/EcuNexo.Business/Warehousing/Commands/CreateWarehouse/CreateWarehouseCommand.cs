using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Warehousing.Commands.CreateWarehouse;

public sealed record CreateWarehouseCommand(
    Guid TenantId,
    string Name,
    string? Code = null,
    bool IsMain = false) : ICommand<CreateWarehouseResponse>;

public sealed record CreateWarehouseResponse(Guid WarehouseId, Guid TenantId);
