using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Warehousing.Commands.UpdateWarehouse;

public sealed record UpdateWarehouseCommand(
    Guid TenantId,
    Guid WarehouseId,
    string Name,
    string? Code = null,
    string? AddressLine1 = null,
    string? City = null,
    string? Notes = null) : ICommand<UpdateWarehouseResponse>;

public sealed record UpdateWarehouseResponse(Guid WarehouseId, Guid TenantId);
