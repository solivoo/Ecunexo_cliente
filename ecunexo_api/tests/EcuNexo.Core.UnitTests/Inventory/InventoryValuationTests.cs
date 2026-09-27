using EcuNexo.Core.Inventory;
using EcuNexo.Core.UnitTests.Support;

namespace EcuNexo.Core.UnitTests.Inventory;

/// <summary>Valorización: costo unitario en líneas/movimientos y costo promedio ponderado en stock.</summary>
public sealed class InventoryValuationTests
{
    private static Stock NewStock() =>
        Stock.Create(Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7(), Guid.CreateVersion7()).Value!;

    [Fact(DisplayName = "Ingreso con costo calcula el costo promedio ponderado")]
    public void Increase_WithCost_ComputesWeightedAverage()
    {
        var stock = NewStock();

        stock.Increase(10m, unitCost: 2m).IsSuccess.Should().BeTrue();
        stock.Increase(10m, unitCost: 4m).IsSuccess.Should().BeTrue();

        stock.Quantity.Should().Be(20m);
        stock.AverageCost.Should().Be(3m);
        stock.LastCost.Should().Be(4m);
        stock.StockValue.Should().Be(60m);
    }

    [Fact(DisplayName = "Ingreso sin costo no altera el promedio")]
    public void Increase_WithoutCost_KeepsAverage()
    {
        var stock = NewStock();
        stock.Increase(10m, unitCost: 2m);

        stock.Increase(5m);

        stock.Quantity.Should().Be(15m);
        stock.AverageCost.Should().Be(2m);
    }

    [Fact(DisplayName = "Costo negativo en stock falla con validación")]
    public void Increase_WithNegativeCost_Fails()
    {
        var stock = NewStock();

        var result = stock.Increase(1m, unitCost: -1m);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.cost.range");
        stock.Quantity.Should().Be(0m);
    }

    [Fact(DisplayName = "La línea del documento normaliza el costo y rechaza negativos")]
    public void DocumentLine_NormalizesCost()
    {
        var ok = InventoryDocumentLine.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            5m,
            unitCost: 3.14159m);

        ok.IsSuccess.Should().BeTrue();
        ok.Value!.UnitCost.Should().Be(3.1416m);

        var bad = InventoryDocumentLine.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            5m,
            unitCost: -0.01m);

        bad.IsFailure.Should().BeTrue();
        bad.Error!.Code.Should().Be("inventory.document.line.cost.range");
    }

    [Fact(DisplayName = "El movimiento guarda el costo unitario del kárdex")]
    public void Movement_StoresUnitCost()
    {
        var item = CatalogTestFactory.Physical();

        var movement = InventoryMovement.Create(
            Guid.CreateVersion7(),
            item.TenantId,
            item.Id,
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            InventoryMovementDirection.In,
            3m,
            DateTimeOffset.UtcNow,
            createdBy: null,
            unitCost: 1.5m);

        movement.IsSuccess.Should().BeTrue();
        movement.Value!.UnitCost.Should().Be(1.5m);
    }
}
