using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;

namespace EcuNexo.Core.Inventory;

/// <summary>Saldo actual por ítem + bodega. El kárdex no se lista desde aquí (ADR-010).</summary>
public sealed class Stock : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    private Stock()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public CatalogItem? CatalogItem { get; private set; }

    public Guid WarehouseId { get; private set; }

    public Warehouse? Warehouse { get; private set; }

    public decimal Quantity { get; private set; }

    /// <summary>Umbral de alerta. Null = sin alerta configurada.</summary>
    public decimal? MinimumQuantity { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    /// <summary>True cuando hay umbral y el saldo está en o por debajo.</summary>
    public bool IsBelowMinimum =>
        MinimumQuantity is decimal min && Quantity <= min;

    public static Result<Stock> Create(
        Guid id,
        Guid tenantId,
        Guid catalogItemId,
        Guid warehouseId)
    {
        if (tenantId == Guid.Empty || catalogItemId == Guid.Empty || warehouseId == Guid.Empty)
        {
            return Result.Failure<Stock>(
                new Error("inventory.stock.keys.invalid", "Tenant, ítem y bodega son obligatorios.", ErrorType.Validation));
        }

        return new Stock
        {
            Id = id,
            TenantId = tenantId,
            CatalogItemId = catalogItemId,
            WarehouseId = warehouseId,
            Quantity = 0,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result SetMinimumQuantity(decimal? minimumQuantity, Guid? updatedBy)
    {
        if (minimumQuantity is null)
        {
            MinimumQuantity = null;
            Touch(updatedBy);
            return Result.Success();
        }

        if (minimumQuantity.Value < 0)
        {
            return Result.Failure(
                new Error(
                    "inventory.stock.minimum.range",
                    "El stock mínimo no puede ser negativo.",
                    ErrorType.Validation));
        }

        MinimumQuantity = decimal.Round(minimumQuantity.Value, 4, MidpointRounding.AwayFromZero);
        Touch(updatedBy);
        return Result.Success();
    }

    public Result Increase(decimal quantity, Guid? updatedBy)
    {
        var qty = InventoryQuantity.NormalizePositive(quantity);
        if (qty.IsFailure)
        {
            return Result.Failure(qty.Error!);
        }

        Quantity += qty.Value;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result Decrease(decimal quantity, Guid? updatedBy)
    {
        var qty = InventoryQuantity.NormalizePositive(quantity);
        if (qty.IsFailure)
        {
            return Result.Failure(qty.Error!);
        }

        if (Quantity < qty.Value)
        {
            return Result.Failure(
                new Error(
                    "inventory.stock.insufficient",
                    "No hay stock suficiente en la bodega para este ítem.",
                    ErrorType.Conflict));
        }

        var wasBelow = IsBelowMinimum;
        Quantity -= qty.Value;
        Touch(updatedBy);

        // Evento de dominio para futuros outbox / SignalR (ADR-007); hoy lo consume la UI vía IsBelowMinimum.
        if (!wasBelow && IsBelowMinimum)
        {
            Raise(
                new StockFellBelowMinimum(
                    Id,
                    TenantId,
                    CatalogItemId,
                    WarehouseId,
                    Quantity,
                    MinimumQuantity!.Value));
        }

        return Result.Success();
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
