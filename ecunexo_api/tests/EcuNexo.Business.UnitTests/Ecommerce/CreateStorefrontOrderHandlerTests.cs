using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class CreateStorefrontOrderHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly IEcommerceOrderRepository _orders = Substitute.For<IEcommerceOrderRepository>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly CreateStorefrontOrderHandler _sut;

    private static readonly EcommerceStorefrontSettings DefaultSettings = new(
        [EcommercePaymentMethod.BankTransfer],
        [
            new ShippingMethodOption(EcommerceShippingMethod.Courier, 3.5m),
            new ShippingMethodOption(EcommerceShippingMethod.StorePickup, 0m),
        ],
        "Transfiere a la cuenta 22001234",
        24);

    public CreateStorefrontOrderHandlerTests()
    {
        _sut = new CreateStorefrontOrderHandler(
            new CreateStorefrontOrderValidator(),
            _tenants,
            _warehouses,
            _settings,
            _orders,
            _sender);
    }

    [Fact(DisplayName = "Crea el pedido invitado con costo de envío del setting y datos de sistema")]
    public async Task Handle_CreatesOrderWithSettingsShippingCost()
    {
        var tenantId = SetupTenant();
        var orderId = Guid.CreateVersion7();
        var warehouse = SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);

        CreateEcommerceOrderCommand? captured = null;
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Do<CreateEcommerceOrderCommand>(command => captured = command),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateEcommerceOrderResponse(
                orderId,
                "ECO-202609-0001",
                EcommerceOrderStatus.Placed,
                100m,
                15m,
                3.5m,
                118.5m,
                EcommercePaymentMethod.BankTransfer)));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.OrderId.Should().Be(orderId);
        result.Value.OrderNumber.Should().Be("ECO-202609-0001");
        result.Value.Status.Should().Be("Placed");
        result.Value.ShippingCost.Should().Be(3.5m);
        result.Value.PaymentInstructions.Should().Be("Transfiere a la cuenta 22001234");

        captured.Should().NotBeNull();
        captured!.WarehouseId.Should().Be(warehouse.Id);
        captured.ShippingCost.Should().Be(3.5m);
        captured.PaymentMethod.Should().Be(EcommercePaymentMethod.BankTransfer);
        captured.ShippingMethod.Should().Be(EcommerceShippingMethod.Courier);
        captured.CreatedBy.Should().BeNull();
        captured.CreatedByName.Should().Be(CreateStorefrontOrderHandler.SystemCustomerName);
        captured.ClientRequestId.Should().Be("req-1");
        captured.CustomerNotes.Should().Be("Entregar en la tarde");
        captured.Customer.TaxId.Should().Be(CreateStorefrontOrderHandler.DefaultConsumerTaxId);
        captured.Customer.TaxIdType.Should().Be(CreateStorefrontOrderHandler.DefaultConsumerTaxIdType);
        captured.Customer.Email.Should().Be("maria.lopez@example.com");
        captured.Shipping.RecipientName.Should().Be("María López");
        captured.Shipping.RecipientPhone.Should().Be("0987654321");
        captured.Shipping.Notes.Should().Be("Timbre 2B");
        captured.Items.Should().ContainSingle().Which.Quantity.Should().Be(2);
    }

    [Fact(DisplayName = "Repetición idempotente devuelve el pedido existente sin crear otro")]
    public async Task Handle_RepeatedRequestId_ReturnsExistingOrder()
    {
        var tenantId = SetupTenant();
        var warehouseId = Guid.CreateVersion7();
        var existing = CreateExistingOrder(tenantId, warehouseId, "req-1");
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns(existing);

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.OrderId.Should().Be(existing.Id);
        result.Value.OrderNumber.Should().Be(existing.OrderNumber);
        result.Value.Subtotal.Should().Be(100m);
        result.Value.TaxAmount.Should().Be(15m);
        result.Value.TotalAmount.Should().Be(118.5m);
        result.Value.PaymentInstructions.Should().Be("Transfiere a la cuenta 22001234");

        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
        await _warehouses.DidNotReceiveWithAnyArgs().GetMainAsync(default, default);
    }

    [Fact(DisplayName = "Sin bodega principal responde 409 ecommerce.checkout.warehouse_missing")]
    public async Task Handle_WithoutMainWarehouse_ReturnsConflict()
    {
        var tenantId = SetupTenant();
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _warehouses.GetMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Warehouse?)null);

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.warehouse_missing");
        result.Error.Type.Should().Be(ErrorType.Conflict);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Un método no habilitado responde 400 ecommerce.checkout.method_not_available")]
    public async Task Handle_DisabledMethod_ReturnsValidationError()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.CreditCard],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
            string.Empty,
            24));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.method_not_available");
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Conflicto de stock del handler interno se mapea a ecommerce.order.stock_conflict")]
    public async Task Handle_StockConflict_MapsToStockConflict()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Any<CreateEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Failure<CreateEcommerceOrderResponse>(new Error(
                "inventory.stock.insufficient_available",
                "No hay stock.",
                ErrorType.Conflict)));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.order.stock_conflict");
        result.Error.Message.Should().Be("El producto se agotó mientras comprabas.");
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact(DisplayName = "Un conflicto de concurrencia al guardar se mapea a 409 de stock")]
    public async Task Handle_ConcurrencyConflict_MapsToStockConflict()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Any<CreateEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromException<Result<CreateEcommerceOrderResponse>>(
                new ConcurrencyConflictException("conflicto")));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.order.stock_conflict");
    }

    [Fact(DisplayName = "Tienda inexistente no crea pedidos")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    private Guid SetupTenant()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
        return tenantId;
    }

    private Warehouse SetupWarehouse(Guid tenantId)
    {
        var warehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            tenantId,
            "Bodega Principal",
            "BOD-01",
            isMain: true).Value!;

        _warehouses.GetMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(warehouse);
        return warehouse;
    }

    private void SetupSettings(Guid tenantId) =>
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(DefaultSettings);

    private static CreateStorefrontOrderCommand CreateCommand(Guid tenantId, string requestId = "req-1") =>
        new(
            tenantId,
            requestId,
            new CreateStorefrontOrderCustomerInput(
                "María López",
                "maria.lopez@example.com",
                "0987654321",
                null),
            new CreateStorefrontOrderShippingInput("Av. Amazonas y Colón", "Quito", "Timbre 2B"),
            "BankTransfer",
            "Courier",
            [new CreateStorefrontOrderItemInput(Guid.CreateVersion7(), 2)],
            "Entregar en la tarde");

    private static EcommerceOrder CreateExistingOrder(Guid tenantId, Guid warehouseId, string requestId)
    {
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            tenantId,
            "ECO-202609-0001",
            warehouseId,
            EcommercePaymentMethod.BankTransfer,
            EcommerceShippingMethod.Courier,
            new EcommerceCustomerInfo(
                "María López",
                "1712345678",
                "05",
                "maria.lopez@example.com",
                "0987654321",
                "Av. Amazonas y Colón"),
            new EcommerceShippingInfo(
                "María López",
                "0987654321",
                "Av. Amazonas y Colón",
                null,
                "Quito",
                null,
                null,
                null,
                null,
                null),
            shippingCost: 3.5m,
            clientRequestId: requestId).Value!;

        var item = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            Guid.CreateVersion7(),
            "SKU-01",
            "Producto Prueba",
            quantity: 2m,
            unitPrice: 50m,
            taxRate: 0.15m).Value!;

        order.AddItem(item);
        return order;
    }
}
