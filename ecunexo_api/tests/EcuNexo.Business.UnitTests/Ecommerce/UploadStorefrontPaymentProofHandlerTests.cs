using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.UploadStorefrontPaymentProof;
using EcuNexo.Business.Storage;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class UploadStorefrontPaymentProofHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IEcommerceOrderRepository _orders = Substitute.For<IEcommerceOrderRepository>();
    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly IEmailSender _emailSender = Substitute.For<IEmailSender>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UploadStorefrontPaymentProofHandler _sut;

    public UploadStorefrontPaymentProofHandlerTests()
    {
        _storage.PrivateBucket.Returns("ecunexo-private-assets");
        _settings
            .ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new EcommerceStorefrontSettings(
                [EcommercePaymentMethod.BankTransfer],
                [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
                string.Empty,
                2,
                true,
                string.Empty,
                "equipo@tienda.com"));
        var notifier = new EcommerceOrderEmailNotifier(
            _emailSender,
            _settings,
            NullLogger<EcommerceOrderEmailNotifier>.Instance);
        _sut = new UploadStorefrontPaymentProofHandler(_tenants, _orders, _storage, notifier, _unitOfWork);
    }

    [Fact(DisplayName = "Sube el comprobante al bucket privado, registra el pedido y responde metadatos")]
    public async Task Handle_ValidProof_UploadsAndRegisters()
    {
        var tenantId = SetupTenant();
        var order = CreateOrder(tenantId);
        _orders.GetTrackedWithDetailsAsync(tenantId, order.Id, Arg.Any<CancellationToken>()).Returns(order);

        using var content = new MemoryStream([1, 2, 3, 4]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            order.Id,
            order.PaymentProofToken,
            "pago.png",
            "image/png",
            content.Length,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ContentType.Should().Be("image/png");
        result.Value.FileName.Should().Be("pago.png");

        order.PaymentProofObjectKey.Should().NotBeNull();
        order.PaymentProofObjectKey.Should().StartWith(
            $"tenants/{tenantId}/ecommerce/orders/{order.Id}/comprobante-");
        order.PaymentProofObjectKey.Should().EndWith(".png");
        order.PaymentProofContentType.Should().Be("image/png");
        order.PaymentProofUploadedAtUtc.Should().NotBeNull();
        order.Timeline.Should().HaveCount(2);
        order.Timeline.Should().Contain(t => t.Notes == "Comprobante de pago recibido.");

        await _storage.Received(1).UploadPrivateAsync(
            order.PaymentProofObjectKey!,
            Arg.Any<Stream>(),
            "image/png",
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _emailSender.Received(1).SendAsync(
            Arg.Is<EmailMessage>(message =>
                message.ToAddress == "equipo@tienda.com"
                && message.Subject == "Comprobante recibido · ECO-202609-0001"),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Token inválido responde 403 ecommerce.checkout.proof_token_invalid")]
    public async Task Handle_InvalidToken_ReturnsForbidden()
    {
        var tenantId = SetupTenant();
        var order = CreateOrder(tenantId);
        _orders.GetTrackedWithDetailsAsync(tenantId, order.Id, Arg.Any<CancellationToken>()).Returns(order);

        using var content = new MemoryStream([1, 2, 3]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            order.Id,
            "token-falso",
            "pago.pdf",
            "application/pdf",
            content.Length,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.proof_token_invalid");
        result.Error.Type.Should().Be(ErrorType.Forbidden);
        await _storage.DidNotReceiveWithAnyArgs()
            .UploadPrivateAsync(default!, default!, default!, default);
    }

    [Fact(DisplayName = "Pedido ya confirmado responde 409 ecommerce.checkout.proof_not_allowed")]
    public async Task Handle_NotAllowedState_ReturnsConflict()
    {
        var tenantId = SetupTenant();
        var order = CreateOrder(tenantId);
        order.ConfirmPayment(null, null, null);
        _orders.GetTrackedWithDetailsAsync(tenantId, order.Id, Arg.Any<CancellationToken>()).Returns(order);

        using var content = new MemoryStream([1, 2, 3]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            order.Id,
            order.PaymentProofToken,
            "pago.jpg",
            "image/jpeg",
            content.Length,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.proof_not_allowed");
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }

    [Theory(DisplayName = "Tipo o extensión no permitidas responden 400 ecommerce.checkout.proof_invalid_file")]
    [InlineData("pago.exe", "application/octet-stream")]
    [InlineData("pago.png", "application/pdf")]
    [InlineData("pago.pdf", "image/png")]
    public async Task Handle_InvalidFileType_ReturnsValidation(string fileName, string contentType)
    {
        var tenantId = SetupTenant();
        var order = CreateOrder(tenantId);
        _orders.GetTrackedWithDetailsAsync(tenantId, order.Id, Arg.Any<CancellationToken>()).Returns(order);

        using var content = new MemoryStream([1, 2, 3]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            order.Id,
            order.PaymentProofToken,
            fileName,
            contentType,
            content.Length,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.proof_invalid_file");
        result.Error.Type.Should().Be(ErrorType.Validation);
    }

    [Fact(DisplayName = "Archivo mayor a 5 MB responde 413 ecommerce.checkout.proof_too_large")]
    public async Task Handle_TooLarge_ReturnsPayloadTooLarge()
    {
        var tenantId = SetupTenant();
        var order = CreateOrder(tenantId);
        _orders.GetTrackedWithDetailsAsync(tenantId, order.Id, Arg.Any<CancellationToken>()).Returns(order);

        using var content = new MemoryStream([1, 2, 3]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            order.Id,
            order.PaymentProofToken,
            "pago.pdf",
            "application/pdf",
            UploadStorefrontPaymentProofHandler.MaxFileSizeBytes + 1,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.checkout.proof_too_large");
        result.Error.Type.Should().Be(ErrorType.PayloadTooLarge);
        await _storage.DidNotReceiveWithAnyArgs()
            .UploadPrivateAsync(default!, default!, default!, default);
    }

    [Fact(DisplayName = "Pedido inexistente responde 404")]
    public async Task Handle_UnknownOrder_ReturnsNotFound()
    {
        var tenantId = SetupTenant();
        var orderId = Guid.CreateVersion7();
        _orders.GetTrackedWithDetailsAsync(tenantId, orderId, Arg.Any<CancellationToken>())
            .Returns((EcommerceOrder?)null);

        using var content = new MemoryStream([1, 2, 3]);
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            orderId,
            "token",
            "pago.pdf",
            "application/pdf",
            content.Length,
            content);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("ecommerce.order.not_found");
    }

    private Guid SetupTenant()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
        return tenantId;
    }

    private static EcommerceOrder CreateOrder(Guid tenantId) =>
        EcommerceOrder.Create(
            Guid.CreateVersion7(),
            tenantId,
            "ECO-202609-0001",
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
}
