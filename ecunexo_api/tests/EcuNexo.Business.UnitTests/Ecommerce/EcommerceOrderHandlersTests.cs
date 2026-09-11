using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Commands.ShipEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class EcommerceOrderHandlersTests
{
    private static (EcommerceCustomerInfo Customer, EcommerceShippingInfo Shipping) CreateSampleInfo()
    {
        var customer = new EcommerceCustomerInfo(
            CustomerName: "María López",
            TaxId: "1712345678",
            TaxIdType: "05",
            Email: "maria.lopez@example.com",
            Phone: "0987654321",
            Address: "Av. Amazonas y Colón");

        var shipping = new EcommerceShippingInfo(
            RecipientName: "María López",
            RecipientPhone: "0987654321",
            AddressLine1: "Calle Los Pinos 456",
            AddressLine2: null,
            City: "Quito",
            Province: "Pichincha",
            PostalCode: "170104",
            Carrier: null,
            TrackingNumber: null,
            Notes: "Timbre 2B");

        return (customer, shipping);
    }

    [Fact(DisplayName = "CreateEcommerceOrderHandler reserva stock correctamente en la bodega")]
    public async Task Handle_CreateOrder_ReservesStockSuccessfully()
    {
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();

        var warehouse = Warehouse.Create(warehouseId, tenantId, "Bodega Principal", "BOD-01", isMain: true).Value!;
        var catalogItem = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Teclado Mecánico RGB",
            description: null,
            sku: "TEC-RGB-01",
            basePrice: 80m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var stock = Stock.Create(Guid.CreateVersion7(), tenantId, itemId, warehouseId).Value!;
        stock.Increase(10m, null); // Saldo físico 10

        var validator = new CreateEcommerceOrderValidator();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(Guid.CreateVersion7());

        var warehouses = Substitute.For<IWarehouseRepository>();
        warehouses.GetActiveByIdAsync(tenantId, warehouseId, Arg.Any<CancellationToken>()).Returns(warehouse);

        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>()).Returns(catalogItem);

        var stocks = Substitute.For<IStockRepository>();
        stocks.GetTrackedAsync(tenantId, itemId, warehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var orders = Substitute.For<IEcommerceOrderRepository>();
        orders.GenerateNextOrderNumberAsync(tenantId, Arg.Any<CancellationToken>()).Returns("ECO-202609-0001");

        var uow = Substitute.For<IUnitOfWork>();

        var sut = new CreateEcommerceOrderHandler(validator, idGen, warehouses, items, stocks, orders, uow);

        var (customer, shipping) = CreateSampleInfo();
        var command = new CreateEcommerceOrderCommand(
            TenantId: tenantId,
            WarehouseId: warehouseId,
            PaymentMethod: EcommercePaymentMethod.CreditCard,
            ShippingMethod: EcommerceShippingMethod.Courier,
            Customer: customer,
            Shipping: shipping,
            Items: [new CreateEcommerceOrderItemInput(itemId, Quantity: 3m, UnitPrice: 80m)],
            ShippingCost: 5m);

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.OrderNumber.Should().Be("ECO-202609-0001");
        stock.ReservedQuantity.Should().Be(3m);
        stock.AvailableQuantity.Should().Be(7m);
        await orders.Received(1).AddAsync(Arg.Any<EcommerceOrder>(), Arg.Any<CancellationToken>());
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateEcommerceOrderHandler falla con conflicto si no hay suficiente stock disponible")]
    public async Task Handle_CreateOrder_WhenStockInsufficient_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();

        var warehouse = Warehouse.Create(warehouseId, tenantId, "Bodega Principal", "BOD-01", isMain: true).Value!;
        var catalogItem = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Monitor Gamer 144Hz",
            description: null,
            sku: "MON-144",
            basePrice: 250m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var stock = Stock.Create(Guid.CreateVersion7(), tenantId, itemId, warehouseId).Value!;
        stock.Increase(2m, null); // Solo 2 unidades

        var validator = new CreateEcommerceOrderValidator();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(Guid.CreateVersion7());
        var warehouses = Substitute.For<IWarehouseRepository>();
        warehouses.GetActiveByIdAsync(tenantId, warehouseId, Arg.Any<CancellationToken>()).Returns(warehouse);

        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>()).Returns(catalogItem);

        var stocks = Substitute.For<IStockRepository>();
        stocks.GetTrackedAsync(tenantId, itemId, warehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var orders = Substitute.For<IEcommerceOrderRepository>();
        orders.GenerateNextOrderNumberAsync(tenantId, Arg.Any<CancellationToken>()).Returns("ECO-202609-0002");

        var uow = Substitute.For<IUnitOfWork>();

        var sut = new CreateEcommerceOrderHandler(validator, idGen, warehouses, items, stocks, orders, uow);

        var (customer, shipping) = CreateSampleInfo();
        var command = new CreateEcommerceOrderCommand(
            TenantId: tenantId,
            WarehouseId: warehouseId,
            PaymentMethod: EcommercePaymentMethod.BankTransfer,
            ShippingMethod: EcommerceShippingMethod.Courier,
            Customer: customer,
            Shipping: shipping,
            Items: [new CreateEcommerceOrderItemInput(itemId, Quantity: 5m, UnitPrice: 250m)]); // Pide 5 habiendo 2

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("inventory.stock.insufficient_available");
        stock.ReservedQuantity.Should().Be(0m);
        await uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CancelEcommerceOrderHandler libera la reserva de stock al cancelar")]
    public async Task Handle_CancelOrder_ReleasesStockReservation()
    {
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        var orderId = Guid.CreateVersion7();

        var stock = Stock.Create(Guid.CreateVersion7(), tenantId, itemId, warehouseId).Value!;
        stock.Increase(10m, null);
        stock.Reserve(4m, null); // 4 reservadas

        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            orderId,
            tenantId,
            "ECO-202609-0003",
            warehouseId,
            EcommercePaymentMethod.BankTransfer,
            EcommerceShippingMethod.Courier,
            customer,
            shipping).Value!;

        var item = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            itemId,
            "SKU-01",
            "Producto Prueba",
            quantity: 4m,
            unitPrice: 50m).Value!;
        order.AddItem(item);

        var orders = Substitute.For<IEcommerceOrderRepository>();
        orders.GetTrackedWithDetailsAsync(tenantId, orderId, Arg.Any<CancellationToken>()).Returns(order);

        var stocks = Substitute.For<IStockRepository>();
        stocks.GetTrackedAsync(tenantId, itemId, warehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var uow = Substitute.For<IUnitOfWork>();

        var sut = new CancelEcommerceOrderHandler(orders, stocks, uow);
        var command = new CancelEcommerceOrderCommand(tenantId, orderId, "No realizó la transferencia");

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Cancelled);
        stock.ReservedQuantity.Should().Be(0m);
        stock.AvailableQuantity.Should().Be(10m);
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "ShipEcommerceOrderHandler liquida la reserva y descuenta el físico al despachar")]
    public async Task Handle_ShipOrder_CommitsStockReservation()
    {
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        var orderId = Guid.CreateVersion7();

        var stock = Stock.Create(Guid.CreateVersion7(), tenantId, itemId, warehouseId).Value!;
        stock.Increase(10m, null);
        stock.Reserve(3m, null);

        var (customer, shipping) = CreateSampleInfo();
        var order = EcommerceOrder.Create(
            orderId,
            tenantId,
            "ECO-202609-0004",
            warehouseId,
            EcommercePaymentMethod.CreditCard,
            EcommerceShippingMethod.Courier,
            customer,
            shipping).Value!;

        var item = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            itemId,
            "SKU-01",
            "Producto Despacho",
            quantity: 3m,
            unitPrice: 20m).Value!;
        order.AddItem(item);
        order.ConfirmPayment("AUTH-123", null, "Admin");

        var orders = Substitute.For<IEcommerceOrderRepository>();
        orders.GetTrackedWithDetailsAsync(tenantId, orderId, Arg.Any<CancellationToken>()).Returns(order);

        var stocks = Substitute.For<IStockRepository>();
        stocks.GetTrackedAsync(tenantId, itemId, warehouseId, Arg.Any<CancellationToken>()).Returns(stock);

        var uow = Substitute.For<IUnitOfWork>();

        var sut = new ShipEcommerceOrderHandler(orders, stocks, uow);
        var command = new ShipEcommerceOrderCommand(tenantId, orderId, "Servientrega", "GUIA-999888");

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        order.Status.Should().Be(EcommerceOrderStatus.Shipped);
        stock.Quantity.Should().Be(7m); // Descontado del físico
        stock.ReservedQuantity.Should().Be(0m); // Liquidado de la reserva
        stock.AvailableQuantity.Should().Be(7m);
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
