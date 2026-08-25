using EcuNexo.Business.Inventory.Commands.SetStockMinimum;

namespace EcuNexo.Api.Contracts.V1.Inventory;

public sealed record SetStockMinimumRequest(decimal? MinimumQuantity)
{
    public SetStockMinimumCommand ToCommand(Guid tenantId, Guid stockId) =>
        new(tenantId, stockId, MinimumQuantity);
}
