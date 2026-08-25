namespace EcuNexo.Core.Inventory;

/// <summary>
/// El saldo cruzó el umbral mínimo tras un egreso/ajuste.
/// Listo para outbox / SignalR; la UI hoy usa <see cref="Stock.IsBelowMinimum"/>.
/// </summary>
public sealed record StockFellBelowMinimum(
    Guid StockId,
    Guid TenantId,
    Guid CatalogItemId,
    Guid WarehouseId,
    decimal Quantity,
    decimal MinimumQuantity) : Common.IDomainEvent;
