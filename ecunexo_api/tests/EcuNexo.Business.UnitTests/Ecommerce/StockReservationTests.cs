using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Business.Ecommerce.Reservations;
using EcuNexo.Business.Ecommerce.Reservations.AddStockReservationPayment;
using EcuNexo.Business.Ecommerce.Reservations.CancelStockReservation;
using EcuNexo.Business.Ecommerce.Reservations.CreateStockReservation;
using EcuNexo.Business.Ecommerce.Reservations.InvoiceStockReservation;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Storage;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class StockReservationTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly Guid WarehouseId = Guid.CreateVersion7();
    private static readonly Guid CustomerId = Guid.CreateVersion7();
    private static readonly Guid CatalogItemId = Guid.CreateVersion7();
    private static readonly Guid UserId = Guid.CreateVersion7();

    [Fact(DisplayName = "Reserva de stock: crea reserva, registra aportes con comprobante y exige observación si se factura con saldo pendiente")]
    public async Task ReservationLifecycle_WithPartialPaymentsAndInvoiceObservation_Succeeds()
    {
        var reservationsRepo = new InMemoryStockReservationRepository();
        var customers = Substitute.For<ICustomerRepository>();
        var warehouses = Substitute.For<IWarehouseRepository>();
        var catalogItems = Substitute.For<ICatalogItemRepository>();
        var stocks = Substitute.For<IStockRepository>();
        var storage = Substitute.For<IStorageService>();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());

        var warehouse = Warehouse.Create(WarehouseId, TenantId, "BOD-01", "Bodega Guayaquil", isMain: true).Value!;
        warehouses.GetActiveByIdAsync(TenantId, WarehouseId, Arg.Any<CancellationToken>()).Returns(warehouse);

        var customer = Customer.Create(CustomerId, TenantId, "María López", "0999999999001", "maria@ecunexo.ec", "0991112222", identificationType: CustomerIdentificationType.ConsumidorFinal).Value!;
        customers.GetByIdAsync(TenantId, CustomerId, Arg.Any<CancellationToken>()).Returns(customer);

        var item = CatalogItem.Create(CatalogItemId, TenantId, CatalogItemKind.Physical, name: "Vestido Floral", description: null, sku: "SKU-VESTIDO-01", basePrice: 50.00m, customAttributesJson: null, categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;
        catalogItems.GetActiveByIdAsync(TenantId, CatalogItemId, Arg.Any<CancellationToken>()).Returns(item);

        var stock = Stock.Create(Guid.CreateVersion7(), TenantId, CatalogItemId, WarehouseId).Value!;
        stock.Increase(10m, null);
        stocks.GetTrackedAsync(TenantId, CatalogItemId, WarehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var createHandler = new CreateStockReservationHandler(
            reservationsRepo, customers, warehouses, catalogItems, stocks, idGen, uow);

        // 1) Reservar 2 unidades ($50 c/u + 15% IVA = $115.00 total)
        var createRes = await createHandler.Handle(
            new CreateStockReservationCommand(
                TenantId,
                WarehouseId,
                CustomerId,
                NewCustomer: null,
                Items: [new CreateReservationItemInput(CatalogItemId, Quantity: 2m, UnitPrice: 50.00m, TaxRate: 15m)],
                CreatedBy: UserId),
            CancellationToken.None);

        createRes.IsSuccess.Should().BeTrue();
        createRes.Value!.TotalAmount.Should().Be(115.00m);
        createRes.Value.BalanceAmount.Should().Be(115.00m);
        stock.ReservedQuantity.Should().Be(2m);
        stock.AvailableQuantity.Should().Be(8m);

        // 2) Registrar un aporte parcial de $50.00 con comprobante adjunto
        var payHandler = new AddStockReservationPaymentHandler(reservationsRepo, storage, idGen, uow);
        using var proofStream = new MemoryStream([1, 2, 3, 4]);
        var payRes = await payHandler.Handle(
            new AddStockReservationPaymentCommand(
                TenantId,
                createRes.Value.Id,
                Amount: 50.00m,
                PaymentMethod: EcommercePaymentMethod.BankTransfer,
                Reference: "TRF-001",
                Notes: "Primer abono",
                FileName: "comprobante.jpg",
                ContentType: "image/jpeg",
                FileLength: 4,
                FileContent: proofStream,
                RecordedBy: UserId),
            CancellationToken.None);

        payRes.IsSuccess.Should().BeTrue();
        payRes.Value!.Status.Should().Be(StockReservationStatus.PartiallyPaid);
        payRes.Value.PaidAmount.Should().Be(50.00m);
        payRes.Value.BalanceAmount.Should().Be(65.00m);
        payRes.Value.IsFullyPaid.Should().BeFalse();
        payRes.Value.Payments.Should().ContainSingle(p => p.HasProof);

        // 3) Intentar facturar SIN observación cuando hay saldo pendiente -> debe fallar
        var invoiceHandler = new InvoiceStockReservationHandler(reservationsRepo, stocks, uow);
        var failInvoice = await invoiceHandler.Handle(
            new InvoiceStockReservationCommand(TenantId, createRes.Value.Id, Guid.CreateVersion7(), Observation: null, UserId: UserId),
            CancellationToken.None);

        failInvoice.IsFailure.Should().BeTrue();
        failInvoice.Error!.Code.Should().Be("ecommerce.reservation.partial_payment_observation_required");

        // 4) Facturar CON observación -> éxito y liquida stock reservado (Quantity baja de 10 a 8, ReservedQuantity baja a 0)
        var okInvoice = await invoiceHandler.Handle(
            new InvoiceStockReservationCommand(
                TenantId,
                createRes.Value.Id,
                Guid.CreateVersion7(),
                Observation: "Saldo pendiente $65.00 a cancelar en entrega",
                UserId: UserId),
            CancellationToken.None);

        okInvoice.IsSuccess.Should().BeTrue();
        okInvoice.Value!.Status.Should().Be(StockReservationStatus.Invoiced);
        okInvoice.Value.InvoiceObservation.Should().Be("Saldo pendiente $65.00 a cancelar en entrega");
        stock.ReservedQuantity.Should().Be(0m);
        stock.Quantity.Should().Be(8m);
    }

    [Fact(DisplayName = "Anular reserva libera el stock reservado en bodega")]
    public async Task CancelReservation_ReleasesReservedStock()
    {
        var reservationsRepo = new InMemoryStockReservationRepository();
        var customers = Substitute.For<ICustomerRepository>();
        var warehouses = Substitute.For<IWarehouseRepository>();
        var catalogItems = Substitute.For<ICatalogItemRepository>();
        var stocks = Substitute.For<IStockRepository>();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());

        var warehouse = Warehouse.Create(WarehouseId, TenantId, "BOD-01", "Bodega Guayaquil", isMain: true).Value!;
        warehouses.GetActiveByIdAsync(TenantId, WarehouseId, Arg.Any<CancellationToken>()).Returns(warehouse);

        var customer = Customer.Create(CustomerId, TenantId, "Carlos Pérez", "9999999999999", identificationType: CustomerIdentificationType.ConsumidorFinal).Value!;
        customers.GetByIdAsync(TenantId, CustomerId, Arg.Any<CancellationToken>()).Returns(customer);

        var item = CatalogItem.Create(CatalogItemId, TenantId, CatalogItemKind.Physical, name: "Blusa", description: null, sku: "SKU-02", basePrice: 20.00m, customAttributesJson: null, categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;
        catalogItems.GetActiveByIdAsync(TenantId, CatalogItemId, Arg.Any<CancellationToken>()).Returns(item);

        var stock = Stock.Create(Guid.CreateVersion7(), TenantId, CatalogItemId, WarehouseId).Value!;
        stock.Increase(5m, null);
        stocks.GetTrackedAsync(TenantId, CatalogItemId, WarehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var createHandler = new CreateStockReservationHandler(
            reservationsRepo, customers, warehouses, catalogItems, stocks, idGen, uow);
        var created = await createHandler.Handle(
            new CreateStockReservationCommand(
                TenantId, WarehouseId, CustomerId, null, [new CreateReservationItemInput(CatalogItemId, 3m)], CreatedBy: UserId),
            CancellationToken.None);

        stock.ReservedQuantity.Should().Be(3m);
        stock.AvailableQuantity.Should().Be(2m);

        var cancelHandler = new CancelStockReservationHandler(reservationsRepo, stocks, uow);
        var cancelled = await cancelHandler.Handle(
            new CancelStockReservationCommand(TenantId, created.Value!.Id, "Cliente desistió", UserId),
            CancellationToken.None);

        cancelled.IsSuccess.Should().BeTrue();
        cancelled.Value!.Status.Should().Be(StockReservationStatus.Cancelled);
        stock.ReservedQuantity.Should().Be(0m);
        stock.AvailableQuantity.Should().Be(5m);
    }

    private sealed class InMemoryStockReservationRepository : IStockReservationRepository
    {
        public List<StockReservation> Items { get; } = [];

        public Task<IReadOnlyList<StockReservation>> ListAsync(
            Guid tenantId, StockReservationStatus? status, string? search, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<StockReservation>>(Items.Where(r => r.TenantId == tenantId).ToList());

        public Task<StockReservation?> GetByIdWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct) =>
            Task.FromResult(Items.FirstOrDefault(r => r.TenantId == tenantId && r.Id == reservationId));

        public Task<StockReservation?> GetTrackedWithDetailsAsync(Guid tenantId, Guid reservationId, CancellationToken ct) =>
            GetByIdWithDetailsAsync(tenantId, reservationId, ct);

        public Task<string> GenerateNextNumberAsync(Guid tenantId, CancellationToken ct) =>
            Task.FromResult($"RES-{Items.Count + 1:00000}");

        public Task AddAsync(StockReservation reservation, CancellationToken ct)
        {
            Items.Add(reservation);
            return Task.CompletedTask;
        }
    }
}
