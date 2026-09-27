using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Core.Ecommerce;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class EcommerceOrderEmailNotifierTests
{
    private const string TeamEmail = "pedidos@tienda.com";

    private readonly IEmailSender _emailSender = Substitute.For<IEmailSender>();
    private readonly IEcommerceStorefrontSettingsReader _settingsReader = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly EcommerceOrderEmailNotifier _sut;

    public EcommerceOrderEmailNotifierTests()
    {
        _settingsReader
            .ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(SettingsWith(TeamEmail));

        _sut = new EcommerceOrderEmailNotifier(
            _emailSender,
            _settingsReader,
            NullLogger<EcommerceOrderEmailNotifier>.Instance);
    }

    [Fact(DisplayName = "Pedido nuevo notifica al equipo y al cliente con las instrucciones de transferencia")]
    public async Task NotifyOrderCreatedAsync_SendsTeamAndClientEmails()
    {
        var order = CreateOrder();

        await _sut.NotifyOrderCreatedAsync(order, "Transfiere a la cuenta 22001234", CancellationToken.None);

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == TeamEmail
                && message.Subject == "Nuevo pedido ECO-202609-0001"
                && message.PlainTextBody.Contains("María López", StringComparison.Ordinal)
                && message.PlainTextBody.Contains("0987654321", StringComparison.Ordinal)
                && message.PlainTextBody.Contains("Teclado Mecánico RGB", StringComparison.Ordinal)
                && message.PlainTextBody.Contains("Transfiere a la cuenta 22001234", StringComparison.Ordinal)
                && message.HtmlBody != null),
            Arg.Any<CancellationToken>());

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == "maria.lopez@example.com"
                && message.Subject == "Pedido recibido · ECO-202609-0001"
                && message.PlainTextBody.Contains("Transfiere a la cuenta 22001234", StringComparison.Ordinal)),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Sin correo de avisos configurado solo se notifica al cliente")]
    public async Task NotifyOrderCreatedAsync_WithoutTeamEmail_NotifiesOnlyClient()
    {
        _settingsReader
            .ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(SettingsWith(string.Empty));
        var order = CreateOrder();

        await _sut.NotifyOrderCreatedAsync(order, null, CancellationToken.None);

        await _emailSender.Received(1).SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>());
        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message => message.ToAddress == "maria.lopez@example.com"),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Sin correo del cliente no se envía nada y no se lanza excepción")]
    public async Task NotifyOrderCreatedAsync_WithoutClientEmail_SkipsWithoutThrowing()
    {
        _settingsReader
            .ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(SettingsWith(string.Empty));
        var order = CreateOrder(clientEmail: string.Empty);

        var act = () => _sut.NotifyOrderCreatedAsync(order, null, CancellationToken.None);

        await act.Should().NotThrowAsync();
        await _emailSender.DidNotReceiveWithAnyArgs().SendAsync(default!, default);
    }

    [Fact(DisplayName = "Comprobante recibido notifica al equipo")]
    public async Task NotifyPaymentProofUploadedAsync_SendsTeamEmail()
    {
        var order = CreateOrder();
        order.RegisterPaymentProof("tenants/t/ecommerce/orders/o/comprobante.png", "image/png", DateTimeOffset.UtcNow);

        await _sut.NotifyPaymentProofUploadedAsync(order, CancellationToken.None);

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == TeamEmail
                && message.Subject == "Comprobante recibido · ECO-202609-0001"),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Pago confirmado notifica al cliente")]
    public async Task NotifyPaymentConfirmedAsync_SendsClientEmail()
    {
        var order = CreateOrder();
        order.ConfirmPayment("TRF-123", null, "Admin");

        await _sut.NotifyPaymentConfirmedAsync(order, CancellationToken.None);

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == "maria.lopez@example.com"
                && message.Subject == "Pago confirmado · ECO-202609-0001"),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Pedido despachado notifica al cliente con transportista y guía")]
    public async Task NotifyOrderShippedAsync_SendsClientEmailWithTracking()
    {
        var order = CreateOrder();
        order.ConfirmPayment("TRF-123", null, "Admin");
        order.MarkShipped("Servientrega", "GUIA-777", null, "Admin");

        await _sut.NotifyOrderShippedAsync(order, CancellationToken.None);

        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == "maria.lopez@example.com"
                && message.Subject == "Pedido despachado · ECO-202609-0001"
                && message.PlainTextBody.Contains("Servientrega", StringComparison.Ordinal)
                && message.PlainTextBody.Contains("GUIA-777", StringComparison.Ordinal)),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Un fallo del sender no interrumpe el flujo (best-effort)")]
    public async Task NotifyOrderCreatedAsync_WhenSenderFails_DoesNotThrow()
    {
        _emailSender
            .SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("SMTP caído")));
        var order = CreateOrder();

        var act = () => _sut.NotifyOrderCreatedAsync(order, null, CancellationToken.None);

        await act.Should().NotThrowAsync();
        await _emailSender.Received(2).SendAsync(Arg.Any<EmailMessage>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Un fallo al resolver settings no impide notificar al cliente")]
    public async Task NotifyOrderCreatedAsync_WhenSettingsFail_StillNotifiesClient()
    {
        _settingsReader
            .ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<EcommerceStorefrontSettings>(new InvalidOperationException("settings")));
        var order = CreateOrder();

        var act = () => _sut.NotifyOrderCreatedAsync(order, null, CancellationToken.None);

        await act.Should().NotThrowAsync();
        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message => message.ToAddress == "maria.lopez@example.com"),
            Arg.Any<CancellationToken>());
    }

    private static EcommerceStorefrontSettings SettingsWith(string teamEmail) =>
        new(
            [EcommercePaymentMethod.BankTransfer],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
            "Transfiere a la cuenta 22001234",
            2,
            true,
            string.Empty,
            teamEmail);

    private static EcommerceOrder CreateOrder(string clientEmail = "maria.lopez@example.com")
    {
        var order = EcommerceOrder.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ECO-202609-0001",
            Guid.CreateVersion7(),
            EcommercePaymentMethod.BankTransfer,
            EcommerceShippingMethod.Courier,
            new EcommerceCustomerInfo(
                "María López",
                "1712345678",
                "05",
                clientEmail,
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

        var item = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            order.Id,
            Guid.CreateVersion7(),
            "SKU-01",
            "Teclado Mecánico RGB",
            quantity: 2m,
            unitPrice: 50m,
            taxRate: 0.15m).Value!;

        order.AddItem(item);
        return order;
    }
}
