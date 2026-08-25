using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Inventory.Commands.SetStockMinimum;

public sealed record SetStockMinimumCommand(
    Guid TenantId,
    Guid StockId,
    decimal? MinimumQuantity) : ICommand<SetStockMinimumResponse>;

public sealed record SetStockMinimumResponse(
    Guid StockId,
    decimal Quantity,
    decimal? MinimumQuantity,
    bool IsBelowMinimum);
