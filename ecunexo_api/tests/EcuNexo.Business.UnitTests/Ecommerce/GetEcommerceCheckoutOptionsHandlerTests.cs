using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceCheckoutOptions;
using EcuNexo.Business.Ecommerce.Storefront.Turnstile;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class GetEcommerceCheckoutOptionsHandlerTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly GetEcommerceCheckoutOptionsHandler _sut;

    public GetEcommerceCheckoutOptionsHandlerTests()
    {
        _sut = new GetEcommerceCheckoutOptionsHandler(
            _tenants,
            _settings,
            Options.Create(new TurnstileOptions()));
    }

    [Fact(DisplayName = "Expone solo los métodos habilitados con labels e instrucciones")]
    public async Task Handle_ReturnsOnlyEnabledMethodsWithLabels()
    {
        var tenantId = SetupTenant();
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.BankTransfer, EcommercePaymentMethod.CashOnDelivery],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 4.5m)],
            "Transfiere a la cuenta 22001234",
            2,
            ContactWhatsapp: "593999999999"));

        var result = await _sut.Handle(new GetEcommerceCheckoutOptionsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var options = result.Value!;

        options.PaymentMethods.Should().HaveCount(2);
        options.PaymentMethods[0].Code.Should().Be("BankTransfer");
        options.PaymentMethods[0].Label.Should().Be("Transferencia bancaria");
        options.PaymentMethods[0].Instructions.Should().Be("Transfiere a la cuenta 22001234");
        options.PaymentMethods[1].Code.Should().Be("CashOnDelivery");
        options.PaymentMethods[1].Label.Should().Be("Contra entrega");
        options.PaymentMethods[1].Instructions.Should().BeNull();

        options.ShippingMethods.Should().ContainSingle();
        options.ShippingMethods[0].Code.Should().Be("Courier");
        options.ShippingMethods[0].Label.Should().Be("Envío a domicilio");
        options.ShippingMethods[0].Cost.Should().Be(4.5m);
        options.WhatsappPhone.Should().Be("593999999999");
    }

    [Fact(DisplayName = "No expone instrucciones de transferencia si el método no está habilitado")]
    public async Task Handle_WithoutBankTransfer_DoesNotExposeInstructions()
    {
        var tenantId = SetupTenant();
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.CreditCard],
            [new ShippingMethodOption(EcommerceShippingMethod.StorePickup, 0m)],
            "Instrucciones secretas",
            24));

        var result = await _sut.Handle(new GetEcommerceCheckoutOptionsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PaymentMethods.Should().ContainSingle()
            .Which.Instructions.Should().BeNull();
    }

    [Fact(DisplayName = "Expone turnstileSiteKey solo cuando Turnstile está habilitado")]
    public async Task Handle_TurnstileConfigured_ExposesSiteKey()
    {
        var tenantId = SetupTenant();
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.BankTransfer],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
            string.Empty,
            24));

        var handler = new GetEcommerceCheckoutOptionsHandler(
            _tenants,
            _settings,
            Options.Create(new TurnstileOptions
            {
                SiteKey = "1x00000000000000000000AA",
                SecretKey = "1x0000000000000000000000000000000AA",
            }));

        var result = await handler.Handle(new GetEcommerceCheckoutOptionsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TurnstileSiteKey.Should().Be("1x00000000000000000000AA");
    }

    [Fact(DisplayName = "No expone turnstileSiteKey si no hay secret key configurada")]
    public async Task Handle_TurnstileDisabled_DoesNotExposeSiteKey()
    {
        var tenantId = SetupTenant();
        _settings.ResolveAsync(tenantId, Arg.Any<CancellationToken>()).Returns(new EcommerceStorefrontSettings(
            [EcommercePaymentMethod.BankTransfer],
            [new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m)],
            string.Empty,
            24));

        var handler = new GetEcommerceCheckoutOptionsHandler(
            _tenants,
            _settings,
            Options.Create(new TurnstileOptions { SiteKey = "1x00000000000000000000AA" }));

        var result = await handler.Handle(new GetEcommerceCheckoutOptionsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.TurnstileSiteKey.Should().BeNull();
    }

    [Fact(DisplayName = "Tienda inexistente no expone opciones de checkout")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var result = await _sut.Handle(new GetEcommerceCheckoutOptionsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _settings.DidNotReceiveWithAnyArgs().ResolveAsync(default, default);
    }

    private Guid SetupTenant()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
        return tenantId;
    }
}
