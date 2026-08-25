using EcuNexo.Business.Inventory;
using EcuNexo.Business.UnitTests.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Inventory;

/// <summary>
/// Prioridad 3 — Al aprobar/despachar se escribe kárdex y se proyecta Stock (ADR-010).
/// Conservación: origen + tránsito + destino no “pierde” unidades en un traspaso.
/// </summary>
public sealed class InventoryDocumentApprovalServiceTests
{
    [Fact(DisplayName = "Aprobar recepción incrementa stock e inserta movimiento IN")]
    public async Task ApproveAsync_Receipt_IncreasesStockAndPostsInMovement()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();
        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Receipt,
            warehouseId,
            notes: null,
            lines: [(Guid.CreateVersion7(), item.Id, 7m)]).Value!;
        var warehouse = Warehouse.Create(
            warehouseId,
            tenantId,
            "Principal",
            code: "P1",
            isMain: true).Value!;

        var stocks = new InMemoryStockRepository();
        var movements = new InMemoryMovementRepository();
        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var sut = new InventoryDocumentApprovalService(ids, stocks, movements);

        // Actuar
        var result = await sut.ApproveAsync(document, warehouse, [item], CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        document.Status.Should().Be(InventoryDocumentStatus.Approved);
        stocks.GetQuantity(tenantId, item.Id, warehouseId).Should().Be(7m);
        movements.Items.Should().ContainSingle(m =>
            m.Direction == InventoryMovementDirection.In && m.Quantity == 7m);
    }

    [Fact(DisplayName = "Traspaso conserva cantidad entre origen, tránsito y destino")]
    public async Task ShipThenReceive_Transfer_ConservesTotalQuantity()
    {
        // Preparar: 10 unidades en origen
        var tenantId = Guid.CreateVersion7();
        var originId = Guid.CreateVersion7();
        var transitId = Guid.CreateVersion7();
        var destinationId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();
        var qty = 4m;

        var origin = Warehouse.Create(originId, tenantId, "Origen", "ORI", isMain: true).Value!;
        var transit = Warehouse.CreateSystem(
            transitId,
            tenantId,
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false).Value!;
        var destination = Warehouse.Create(destinationId, tenantId, "Destino", "DST").Value!;

        var stocks = new InMemoryStockRepository();
        var originStock = Stock.Create(Guid.CreateVersion7(), tenantId, item.Id, originId).Value!;
        originStock.Increase(10m, null);
        await stocks.AddAsync(originStock, CancellationToken.None);

        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Transfer,
            originId,
            notes: null,
            lines: [(Guid.CreateVersion7(), item.Id, qty)],
            destinationWarehouseId: destinationId).Value!;

        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var movements = new InMemoryMovementRepository();
        var sut = new InventoryDocumentApprovalService(ids, stocks, movements);

        // Actuar — despacho (OUT origen + IN tránsito)
        var shipped = await sut.ShipTransferAsync(document, origin, transit, [item], CancellationToken.None);
        // Actuar — recepción (OUT tránsito + IN destino)
        var received = await sut.ReceiveTransferAsync(
            document,
            transit,
            destination,
            [item],
            CancellationToken.None);

        // Verificar: 10 unidades siguen existiendo repartidas
        shipped.IsSuccess.Should().BeTrue(because: shipped.Error?.Message);
        received.IsSuccess.Should().BeTrue(because: received.Error?.Message);
        document.Status.Should().Be(InventoryDocumentStatus.Approved);

        var originQty = stocks.GetQuantity(tenantId, item.Id, originId);
        var transitQty = stocks.GetQuantity(tenantId, item.Id, transitId);
        var destQty = stocks.GetQuantity(tenantId, item.Id, destinationId);
        (originQty + transitQty + destQty).Should().Be(10m);
        originQty.Should().Be(6m);
        transitQty.Should().Be(0m);
        destQty.Should().Be(4m);
        movements.Items.Should().HaveCount(4);
    }

    [Fact(DisplayName = "Despachar transferencia sin stock en origen falla")]
    public async Task ShipTransfer_InsufficientOriginStock_Fails()
    {
        // Preparar: origen vacío
        var tenantId = Guid.CreateVersion7();
        var originId = Guid.CreateVersion7();
        var transitId = Guid.CreateVersion7();
        var destinationId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();

        var origin = Warehouse.Create(originId, tenantId, "Origen", "ORI", isMain: true).Value!;
        var transit = Warehouse.CreateSystem(
            transitId,
            tenantId,
            Warehouse.TransitDefaultName,
            WarehouseSystemRole.Transit,
            Warehouse.TransitDefaultCode,
            isMain: false).Value!;

        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Transfer,
            originId,
            notes: null,
            lines: [(Guid.CreateVersion7(), item.Id, 1m)],
            destinationWarehouseId: destinationId).Value!;

        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var sut = new InventoryDocumentApprovalService(
            ids,
            new InMemoryStockRepository(),
            new InMemoryMovementRepository());

        // Actuar
        var result = await sut.ShipTransferAsync(document, origin, transit, [item], CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.insufficient");
        document.Status.Should().Be(InventoryDocumentStatus.Draft);
    }

    [Fact(DisplayName = "Ajuste: conteo mayor que saldo genera IN por el delta")]
    public async Task ApproveAsync_AdjustmentHigherCount_PostsInDelta()
    {
        // Preparar: sistema tiene 3; conteo físico 8 → IN 5
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();
        var warehouse = Warehouse.Create(warehouseId, tenantId, "Principal", "P1", isMain: true).Value!;

        var stocks = new InMemoryStockRepository();
        var existing = Stock.Create(Guid.CreateVersion7(), tenantId, item.Id, warehouseId).Value!;
        existing.Increase(3m, null);
        await stocks.AddAsync(existing, CancellationToken.None);

        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Adjustment,
            warehouseId,
            notes: "Conteo mensual",
            lines: [(Guid.CreateVersion7(), item.Id, 8m)]).Value!;

        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var movements = new InMemoryMovementRepository();
        var sut = new InventoryDocumentApprovalService(ids, stocks, movements);

        // Actuar
        var result = await sut.ApproveAsync(document, warehouse, [item], CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        stocks.GetQuantity(tenantId, item.Id, warehouseId).Should().Be(8m);
        movements.Items.Should().ContainSingle(m =>
            m.Direction == InventoryMovementDirection.In && m.Quantity == 5m);
    }

    [Fact(DisplayName = "Ajuste: conteo menor que saldo genera OUT por el delta")]
    public async Task ApproveAsync_AdjustmentLowerCount_PostsOutDelta()
    {
        // Preparar: sistema tiene 10; conteo físico 4 → OUT 6
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();
        var warehouse = Warehouse.Create(warehouseId, tenantId, "Principal", "P1", isMain: true).Value!;

        var stocks = new InMemoryStockRepository();
        var existing = Stock.Create(Guid.CreateVersion7(), tenantId, item.Id, warehouseId).Value!;
        existing.Increase(10m, null);
        await stocks.AddAsync(existing, CancellationToken.None);

        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Adjustment,
            warehouseId,
            notes: "Merma detectada",
            lines: [(Guid.CreateVersion7(), item.Id, 4m)]).Value!;

        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var movements = new InMemoryMovementRepository();
        var sut = new InventoryDocumentApprovalService(ids, stocks, movements);

        // Actuar
        var result = await sut.ApproveAsync(document, warehouse, [item], CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        stocks.GetQuantity(tenantId, item.Id, warehouseId).Should().Be(4m);
        movements.Items.Should().ContainSingle(m =>
            m.Direction == InventoryMovementDirection.Out && m.Quantity == 6m);
    }

    [Fact(DisplayName = "Ajuste: conteo igual al saldo no escribe kárdex")]
    public async Task ApproveAsync_AdjustmentEqualCount_NoMovement()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var item = CatalogTestFactory.Physical();
        var warehouse = Warehouse.Create(warehouseId, tenantId, "Principal", "P1", isMain: true).Value!;

        var stocks = new InMemoryStockRepository();
        var existing = Stock.Create(Guid.CreateVersion7(), tenantId, item.Id, warehouseId).Value!;
        existing.Increase(5m, null);
        await stocks.AddAsync(existing, CancellationToken.None);

        var document = InventoryDocument.Create(
            Guid.CreateVersion7(),
            tenantId,
            InventoryDocumentType.Adjustment,
            warehouseId,
            notes: "Sin diferencias",
            lines: [(Guid.CreateVersion7(), item.Id, 5m)]).Value!;

        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        var movements = new InMemoryMovementRepository();
        var sut = new InventoryDocumentApprovalService(ids, stocks, movements);

        // Actuar
        var result = await sut.ApproveAsync(document, warehouse, [item], CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        document.Status.Should().Be(InventoryDocumentStatus.Approved);
        stocks.GetQuantity(tenantId, item.Id, warehouseId).Should().Be(5m);
        movements.Items.Should().BeEmpty();
    }

    /// <summary>Repositorio en memoria: misma instancia trackeada para Increase/Decrease.</summary>
    private sealed class InMemoryStockRepository : IStockRepository
    {
        private readonly List<Stock> _stocks = [];

        public Task AddAsync(Stock stock, CancellationToken ct)
        {
            _stocks.Add(stock);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<Stock>> ListByTenantAsync(Guid tenantId, Guid? warehouseId, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<Stock>>(
                _stocks.Where(s => s.TenantId == tenantId
                    && (warehouseId is null || s.WarehouseId == warehouseId)).ToList());

        public Task<Stock?> GetTrackedAsync(
            Guid tenantId,
            Guid catalogItemId,
            Guid warehouseId,
            CancellationToken ct) =>
            Task.FromResult(
                _stocks.FirstOrDefault(s =>
                    s.TenantId == tenantId
                    && s.CatalogItemId == catalogItemId
                    && s.WarehouseId == warehouseId));

        public Task<Stock?> GetTrackedByIdAsync(Guid tenantId, Guid stockId, CancellationToken ct) =>
            Task.FromResult(_stocks.FirstOrDefault(s => s.TenantId == tenantId && s.Id == stockId));

        public Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct) =>
            Task.FromResult(_stocks.Any(s => s.TenantId == tenantId && s.CatalogItemId == catalogItemId));

        public decimal GetQuantity(Guid tenantId, Guid catalogItemId, Guid warehouseId) =>
            _stocks.FirstOrDefault(s =>
                s.TenantId == tenantId
                && s.CatalogItemId == catalogItemId
                && s.WarehouseId == warehouseId)?.Quantity ?? 0m;
    }

    private sealed class InMemoryMovementRepository : IInventoryMovementRepository
    {
        public List<InventoryMovement> Items { get; } = [];

        public Task AddAsync(InventoryMovement movement, CancellationToken ct)
        {
            Items.Add(movement);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<InventoryMovement>> ListByTenantAsync(
            Guid tenantId,
            Guid? warehouseId,
            Guid? catalogItemId,
            CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<InventoryMovement>>(Items);

        public Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct) =>
            Task.FromResult(Items.Any(m => m.TenantId == tenantId && m.CatalogItemId == catalogItemId));
    }
}
