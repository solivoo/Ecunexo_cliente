using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class EcommercePaymentHoldServiceTests
{
    private readonly IEcommerceOrderRepository _orders = Substitute.For<IEcommerceOrderRepository>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly EcommercePaymentHoldService _sut;

    public EcommercePaymentHoldServiceTests()
    {
        _sut = new EcommercePaymentHoldService(_orders, _settings, _sender);
    }

    [Fact(DisplayName = "Cancela solo los pedidos que superaron el TTL del tenant")]
    public async Task Run_CancelsOnlyOrdersPastTenantTtl()
    {
        var now = DateTimeOffset.UtcNow;
        var strictTenant = Guid.CreateVersion7();
        var patientTenant = Guid.CreateVersion7();

        var expired = CreateOrder(strictTenant, now.AddHours(-30));
        var fresh = CreateOrder(strictTenant, now.AddHours(-2));
        var withinPatientTtl = CreateOrder(patientTenant, now.AddHours(-30));

        SetupSettings(strictTenant, holdHours: 24);
        SetupSettings(patientTenant, holdHours: 720);
        _orders
            .ListPendingPaymentBeforeAsync(Arg.Any<DateTimeOffset>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<EcommerceOrder> { expired, fresh, withinPatientTtl });
        _sender
            .SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(
                Arg.Any<CancelEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CancelEcommerceOrderResponse(
                expired.Id,
                EcommerceOrderStatus.Cancelled,
                EcommercePaymentHoldService.ExpirationReason,
                now)));

        var outcome = await _sut.RunAsync(
            now,
            EcommercePaymentHoldService.DefaultBatchSize,
            CancellationToken.None);

        outcome.Scanned.Should().Be(3);
        outcome.Cancelled.Should().Be(1);
        outcome.Skipped.Should().Be(2);
        outcome.Errors.Should().BeEmpty();

        await _orders.Received(1).ListPendingPaymentBeforeAsync(
            now - EcommercePaymentHoldService.ExpirationLookback,
            EcommercePaymentHoldService.DefaultBatchSize,
            Arg.Any<CancellationToken>());

        await _sender.Received(1).SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(
            Arg.Is<CancelEcommerceOrderCommand>(command =>
                command.OrderId == expired.Id
                && command.TenantId == strictTenant
                && command.UserId == null
                && command.UserName == EcommercePaymentHoldService.SystemUserName
                && command.Reason == EcommercePaymentHoldService.ExpirationReason),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Un fallo al cancelar no tumba la pasada y se reporta en errores")]
    public async Task Run_CancelFailure_IsCollected()
    {
        var now = DateTimeOffset.UtcNow;
        var tenantId = Guid.CreateVersion7();
        var order = CreateOrder(tenantId, now.AddHours(-48));

        SetupSettings(tenantId, holdHours: 24);
        _orders
            .ListPendingPaymentBeforeAsync(Arg.Any<DateTimeOffset>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<EcommerceOrder> { order });
        _sender
            .SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(
                Arg.Any<CancelEcommerceOrderCommand>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Failure<CancelEcommerceOrderResponse>(new Error(
                "ecommerce.order.cannot_cancel_shipped",
                "No se puede anular.",
                ErrorType.Conflict)));

        var outcome = await _sut.RunAsync(now, 10, CancellationToken.None);

        outcome.Scanned.Should().Be(1);
        outcome.Cancelled.Should().Be(0);
        outcome.Errors.Should().ContainSingle()
            .Which.Should().Contain("ecommerce.order.cannot_cancel_shipped");
    }

    [Fact(DisplayName = "Sin candidatos no despacha cancelaciones")]
    public async Task Run_WithoutCandidates_DoesNothing()
    {
        _orders
            .ListPendingPaymentBeforeAsync(Arg.Any<DateTimeOffset>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<EcommerceOrder>());

        var outcome = await _sut.RunAsync(DateTimeOffset.UtcNow, 50, CancellationToken.None);

        outcome.Scanned.Should().Be(0);
        outcome.Cancelled.Should().Be(0);
        outcome.Errors.Should().BeEmpty();
        await _sender.DidNotReceiveWithAnyArgs()
            .SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(default!, default);
    }

    private void SetupSettings(Guid tenantId, int holdHours) =>
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.BankTransfer],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
            string.Empty,
            holdHours));

    private static EcommerceOrder CreateOrder(Guid tenantId, DateTimeOffset orderDate)
    {
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            tenantId,
            "ECO-TEST-0001",
            Guid.CreateVersion7(),
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
                null)).Value!;

        typeof(EcommerceOrder)
            .GetProperty(nameof(EcommerceOrder.OrderDate))!
            .SetValue(order, orderDate);

        return order;
    }
}
