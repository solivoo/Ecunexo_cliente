using EcuNexo.Business.Warehousing.Commands.UpdateWarehouse;

namespace EcuNexo.Api.Contracts.V1.Warehousing;

public sealed record UpdateWarehouseRequest(
    string Name,
    string? Code = null,
    string? AddressLine1 = null,
    string? City = null,
    string? Notes = null)
{
    public UpdateWarehouseCommand ToCommand(Guid tenantId, Guid warehouseId) =>
        new(tenantId, warehouseId, Name, Code, AddressLine1, City, Notes);
}
