using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;
using EcuNexo.Business.Ecommerce.Storefront.Turnstile;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class CreateStorefrontOrderHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly IEcommerceOrderRepository _orders = Substitute.For<IEcommerceOrderRepository>();
    private readonly IEcommerceBlockedContactRepository _blockedContacts = Substitute.For<IEcommerceBlockedContactRepository>();
    private readonly ITurnstileVerifier _turnstile = Substitute.For<ITurnstileVerifier>();
    private readonly IEmailSender _emailSender = Substitute.For<IEmailSender>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly EcommerceOrderEmailNotifier _orderEmailNotifier;
    private readonly ILogger<CreateStorefrontOrderHandler> _logger = NullLogger<CreateStorefrontOrderHandler>.Instance;
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
        _orderEmailNotifier = new EcommerceOrderEmailNotifier(
            _emailSender,
            _settings,
            NullLogger<EcommerceOrderEmailNotifier>.Instance);

        _sut = new CreateStorefrontOrderHandler(
            new CreateStorefrontOrderValidator(),
            _tenants,
            _warehouses,
            _settings,
            _orders,
            _blockedContacts,
            _turnstile,
            _orderEmailNotifier,
            _sender,
            _logger);
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
        _orders
            .GetTrackedWithDetailsAsync(tenantId, orderId, Arg.Any<CancellationToken>())
            .Returns(CreateExistingOrder(tenantId, warehouse.Id, "req-1", orderId));

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
        captured.ReserveStock.Should().BeTrue();
        captured.AcceptPrivacyPolicy.Should().BeTrue();
        captured.Customer.TaxId.Should().Be(CreateStorefrontOrderHandler.DefaultConsumerTaxId);
        captured.Customer.TaxIdType.Should().Be(CreateStorefrontOrderHandler.DefaultConsumerTaxIdType);
        captured.Customer.Email.Should().Be("maria.lopez@example.com");
        captured.Shipping.RecipientName.Should().Be("María López");
        captured.Shipping.RecipientPhone.Should().Be("0987654321");
        captured.Shipping.Notes.Should().Be("Timbre 2B");
        captured.Items.Should().ContainSingle().Which.Quantity.Should().Be(2);

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == "maria.lopez@example.com"
                && message.Subject == "Pedido recibido · ECO-202609-0001"),
            Arg.Any<CancellationToken>());
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

    [Fact(DisplayName = "El honeypot lleno responde ecommerce.checkout.invalid_form")]
    public async Task Handle_FilledHoneypot_ReturnsInvalidForm()
    {
        var tenantId = SetupTenant();
        SetupSettings(tenantId);

        var command = CreateCommand(tenantId) with { ContactFax = "https://spam.example" };
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.invalid_form");
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Sin aceptar la política de datos responde ecommerce.checkout.privacy_required")]
    public async Task Handle_WithoutPrivacyConsent_ReturnsPrivacyRequired()
    {
        var tenantId = SetupTenant();
        SetupSettings(tenantId);

        var command = CreateCommand(tenantId) with { AcceptPrivacyPolicy = false };
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.privacy_required");
        result.Error.Message.Should().Be("Debes aceptar la política de tratamiento de datos personales.");
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Un formulario enviado en menos de 2 segundos responde ecommerce.checkout.invalid_form")]
    public async Task Handle_FormFilledTooFast_ReturnsInvalidForm()
    {
        var tenantId = SetupTenant();
        SetupSettings(tenantId);

        var command = CreateCommand(tenantId) with { FormElapsedMs = 500 };
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.invalid_form");
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Con Turnstile habilitado y sin token responde ecommerce.checkout.captcha_failed")]
    public async Task Handle_CaptchaEnabledWithoutToken_ReturnsCaptchaFailed()
    {
        var tenantId = SetupTenant();
        _turnstile.IsEnabled.Returns(true);
        _turnstile
            .VerifyAsync(Arg.Is<string?>(token => token == null), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(TurnstileVerificationResult.Failed("missing-input-response"));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.captcha_failed");
        result.Error.Type.Should().Be(ErrorType.Validation);
        result.Error.Message.Should().Be("No pudimos verificar que eres humano. Intenta de nuevo.");
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Con Turnstile habilitado y token inválido responde ecommerce.checkout.captcha_failed")]
    public async Task Handle_CaptchaEnabledWithInvalidToken_ReturnsCaptchaFailed()
    {
        var tenantId = SetupTenant();
        _turnstile.IsEnabled.Returns(true);
        _turnstile
            .VerifyAsync("bad-token", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(TurnstileVerificationResult.Failed("invalid-input-response"));

        var command = CreateCommand(tenantId) with { TurnstileToken = "bad-token" };
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.captcha_failed");
        result.Error.Type.Should().Be(ErrorType.Validation);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "Con Turnstile habilitado y token válido crea el pedido")]
    public async Task Handle_CaptchaEnabledWithValidToken_CreatesOrder()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _turnstile.IsEnabled.Returns(true);
        _turnstile
            .VerifyAsync("good-token", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(TurnstileVerificationResult.Ok());

        CreateEcommerceOrderCommand? captured = null;
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Do<CreateEcommerceOrderCommand>(command => captured = command),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateEcommerceOrderResponse(
                Guid.CreateVersion7(),
                "ECO-202609-0003",
                EcommerceOrderStatus.Placed,
                100m,
                15m,
                3.5m,
                118.5m,
                EcommercePaymentMethod.BankTransfer,
                "token-comprobante")));

        var command = CreateCommand(tenantId) with { TurnstileToken = "good-token" };
        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PaymentProofToken.Should().Be("token-comprobante");
        captured.Should().NotBeNull();
        await _turnstile.Received(1).VerifyAsync("good-token", Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Sin Turnstile configurado no se verifica captcha")]
    public async Task Handle_CaptchaDisabled_DoesNotVerify()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _turnstile.IsEnabled.Returns(false);
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Any<CreateEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateEcommerceOrderResponse(
                Guid.CreateVersion7(),
                "ECO-202609-0004",
                EcommerceOrderStatus.Placed,
                100m,
                15m,
                3.5m,
                118.5m,
                EcommercePaymentMethod.BankTransfer)));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _turnstile.DidNotReceiveWithAnyArgs().VerifyAsync(default, default, default);
    }

    [Fact(DisplayName = "Alcanzar el tope de pendientes del setting responde ecommerce.checkout.too_many_pending")]
    public async Task Handle_TooManyPendingOrders_ReturnsConflict()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _orders
            .CountPendingByContactAsync(
                tenantId,
                "maria.lopez@example.com",
                "0987654321",
                Arg.Any<CancellationToken>())
            .Returns(DefaultSettings.MaxPendingOrders);

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.too_many_pending");
        result.Error.Type.Should().Be(ErrorType.Conflict);
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "El tope de pendientes sale del setting de la tienda")]
    public async Task Handle_CustomPendingLimitFromSettings_CreatesOrder()
    {
        var tenantId = SetupTenant();
        var orderId = Guid.CreateVersion7();
        SetupWarehouse(tenantId);
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(DefaultSettings with
        {
            MaxPendingOrders = 10,
        });
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _orders
            .CountPendingByContactAsync(
                tenantId,
                "maria.lopez@example.com",
                "0987654321",
                Arg.Any<CancellationToken>())
            .Returns(DefaultSettings.MaxPendingOrders);
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Any<CreateEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateEcommerceOrderResponse(
                orderId,
                "ECO-202609-0005",
                EcommerceOrderStatus.Placed,
                100m,
                15m,
                3.5m,
                118.5m,
                EcommercePaymentMethod.BankTransfer)));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.OrderId.Should().Be(orderId);
    }

    [Fact(DisplayName = "Un contacto bloqueado responde ecommerce.checkout.blocked_contact 403")]
    public async Task Handle_BlockedContact_ReturnsForbidden()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        SetupSettings(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _blockedContacts
            .ExistsAsync(
                tenantId,
                EcommerceBlockedContactKind.Email,
                "maria.lopez@example.com",
                Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.blocked_contact");
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        result.Error.Message.Should().Be("No podemos procesar este pedido. Contacta a la tienda.");
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(default!, default);
    }

    [Fact(DisplayName = "ReserveOnOrder false crea el pedido sin reservar stock")]
    public async Task Handle_ReserveOnOrderDisabled_SendsReserveStockFalse()
    {
        var tenantId = SetupTenant();
        SetupWarehouse(tenantId);
        _orders
            .FindByClientRequestIdAsync(tenantId, "req-1", Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(DefaultSettings with
        {
            ReserveOnOrder = false,
        });

        CreateEcommerceOrderCommand? captured = null;
        _sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(
                Arg.Do<CreateEcommerceOrderCommand>(command => captured = command),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateEcommerceOrderResponse(
                Guid.CreateVersion7(),
                "ECO-202609-0002",
                EcommerceOrderStatus.Placed,
                100m,
                15m,
                3.5m,
                118.5m,
                EcommercePaymentMethod.BankTransfer)));

        var result = await _sut.Handle(CreateCommand(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        captured.Should().NotBeNull();
        captured!.ReserveStock.Should().BeFalse();
    }

    [Theory(DisplayName = "El email se enmascara en los logs")]
    [InlineData("maria.lopez@example.com", "m***z@example.com")]
    [InlineData("ab@example.com", "***@example.com")]
    [InlineData("", "n/a")]
    [InlineData("sin-arroba", "***")]
    public void MaskEmail_HidesLocalPart(string email, string expected) =>
        CreateStorefrontOrderHandler.MaskEmail(email).Should().Be(expected);

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
            "Entregar en la tarde",
            AcceptPrivacyPolicy: true);

    private static EcommerceOrder CreateExistingOrder(
        Guid tenantId,
        Guid warehouseId,
        string requestId,
        Guid? orderId = null)
    {
        var order = EcommerceOrder.Create(
            orderId ?? Guid.CreateVersion7(),
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
