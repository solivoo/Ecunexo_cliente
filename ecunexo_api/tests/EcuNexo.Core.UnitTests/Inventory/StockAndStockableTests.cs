using EcuNexo.Core.Inventory;
using EcuNexo.Core.UnitTests.Support;

namespace EcuNexo.Core.UnitTests.Inventory;

/// <summary>
/// Prioridad 1 — Invariantes ADR-010: solo físicos entran al kárdex; el saldo nunca baja de cero.
/// </summary>
public sealed class StockAndStockableTests
{
    [Fact(DisplayName = "EnsureStockable rechaza ítems de servicio")]
    public void EnsureStockable_ServiceItem_ReturnsNotStockable()
    {
        // Preparar
        var service = CatalogTestFactory.Service();

        // Actuar
        var result = InventoryDocument.EnsureStockable(service);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.not_stockable");
    }

    [Fact(DisplayName = "EnsureStockable acepta ítems físicos")]
    public void EnsureStockable_PhysicalItem_Succeeds()
    {
        // Preparar
        var physical = CatalogTestFactory.Physical();

        // Actuar
        var result = InventoryDocument.EnsureStockable(physical);

        // Verificar
        result.IsSuccess.Should().BeTrue();
    }

    [Fact(DisplayName = "Decrease con saldo insuficiente falla (nunca negativo)")]
    public void Decrease_InsufficientQuantity_ReturnsConflict()
    {
        // Preparar: stock en cero
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;

        // Actuar
        var result = stock.Decrease(1m, updatedBy: null);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.insufficient");
        stock.Quantity.Should().Be(0m);
    }

    [Fact(DisplayName = "IsBelowMinimum es true cuando el saldo está en o bajo el umbral")]
    public void IsBelowMinimum_WhenQuantityAtOrBelowThreshold_IsTrue()
    {
        // Preparar
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(5m, null);
        stock.SetMinimumQuantity(5m, null).IsSuccess.Should().BeTrue();

        // Verificar
        stock.IsBelowMinimum.Should().BeTrue();
    }

    [Fact(DisplayName = "Decrease que cruza el mínimo levanta StockFellBelowMinimum")]
    public void Decrease_CrossingMinimum_RaisesDomainEvent()
    {
        // Preparar: umbral 3, saldo 4 → egreso 2 → queda 2 (bajo mínimo)
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(4m, null);
        stock.SetMinimumQuantity(3m, null);

        // Actuar
        stock.Decrease(2m, null).IsSuccess.Should().BeTrue();

        // Verificar
        stock.IsBelowMinimum.Should().BeTrue();
        stock.DomainEvents.Should().ContainSingle(e => e is StockFellBelowMinimum);
    }

    [Fact(DisplayName = "Increase luego Decrease deja el saldo esperado")]
    public void IncreaseThenDecrease_UpdatesQuantity()
    {
        // Preparar
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;

        // Actuar
        stock.Increase(10m, null).IsSuccess.Should().BeTrue();
        stock.Decrease(4m, null).IsSuccess.Should().BeTrue();

        // Verificar
        stock.Quantity.Should().Be(6m);
    }

    [Fact(DisplayName = "Reserve incrementa ReservedQuantity y reduce AvailableQuantity")]
    public void Reserve_ValidQuantity_UpdatesReservedAndAvailable()
    {
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(10m, null);

        var result = stock.Reserve(4m, null);

        result.IsSuccess.Should().BeTrue();
        stock.Quantity.Should().Be(10m);
        stock.ReservedQuantity.Should().Be(4m);
        stock.AvailableQuantity.Should().Be(6m);
    }

    [Fact(DisplayName = "Reserve con cantidad mayor a AvailableQuantity falla con conflicto")]
    public void Reserve_MoreThanAvailable_ReturnsConflict()
    {
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(5m, null);
        stock.Reserve(3m, null);

        var result = stock.Reserve(3m, null); // Solo quedan 2 disponibles

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.insufficient_available");
        stock.ReservedQuantity.Should().Be(3m);
    }

    [Fact(DisplayName = "ReleaseReservation decrementa ReservedQuantity y restaura AvailableQuantity")]
    public void ReleaseReservation_ValidQuantity_RestoresAvailable()
    {
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(10m, null);
        stock.Reserve(5m, null);

        var result = stock.ReleaseReservation(3m, null);

        result.IsSuccess.Should().BeTrue();
        stock.ReservedQuantity.Should().Be(2m);
        stock.AvailableQuantity.Should().Be(8m);
    }

    [Fact(DisplayName = "CommitReservation liquida la reserva descontando físico y reservado")]
    public void CommitReservation_ValidQuantity_DecreasesBothQuantities()
    {
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(10m, null);
        stock.Reserve(4m, null);

        var result = stock.CommitReservation(4m, null);

        result.IsSuccess.Should().BeTrue();
        stock.Quantity.Should().Be(6m);
        stock.ReservedQuantity.Should().Be(0m);
        stock.AvailableQuantity.Should().Be(6m);
    }

    [Fact(DisplayName = "Decrease falla si intenta egresar más allá del saldo disponible no reservado")]
    public void Decrease_ExceedingAvailableStockDueToReservations_ReturnsConflict()
    {
        var stock = Stock.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7()).Value!;
        stock.Increase(10m, null);
        stock.Reserve(6m, null); // 4 disponibles

        var result = stock.Decrease(5m, null);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.reserved_conflict");
        stock.Quantity.Should().Be(10m);
    }
}
