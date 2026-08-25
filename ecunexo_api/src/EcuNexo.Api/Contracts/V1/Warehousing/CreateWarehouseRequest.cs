using EcuNexo.Business.Warehousing.Commands.CreateWarehouse;

namespace EcuNexo.Api.Contracts.V1.Warehousing;

public sealed record CreateWarehouseRequest(string Name, string? Code = null, bool IsMain = false)
{
    public CreateWarehouseCommand ToCommand(Guid tenantId) => new(tenantId, Name, Code, IsMain);
}
