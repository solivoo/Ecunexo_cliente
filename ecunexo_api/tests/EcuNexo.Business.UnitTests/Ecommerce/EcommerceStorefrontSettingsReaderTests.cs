using System.Text.Json;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Platform;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class EcommerceStorefrontSettingsReaderTests
{
    private readonly ISettingsResolver _resolver = Substitute.For<ISettingsResolver>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly EcommerceStorefrontSettingsReader _sut;

    public EcommerceStorefrontSettingsReaderTests()
    {
        _resolver
            .ResolveAsync(
                Arg.Any<Guid>(),
                Arg.Any<Guid>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(new Dictionary<string, JsonElement>(StringComparer.Ordinal));

        _sut = new EcommerceStorefrontSettingsReader(_resolver, _tenants);
    }

    [Fact(DisplayName = "Sin settings aplica los defaults de la tienda")]
    public async Task Resolve_WithoutSettings_ReturnsDefaults()
    {
        var tenantId = SetupTenant();

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.PaymentMethods.Should().Equal(EcommercePaymentMethod.BankTransfer);
        settings.ShippingMethods.Should().Equal(new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m));
        settings.BankTransferInstructions.Should().BeEmpty();
        settings.PaymentHoldHours.Should().Be(2);
        settings.PaymentHoldHours.Should().Be(EcommerceStorefrontSettingsReader.DefaultPaymentHoldHours);
        settings.ReserveOnOrder.Should().BeTrue();
        settings.ContactWhatsapp.Should().BeEmpty();
        settings.OrdersNotificationEmail.Should().BeEmpty();
    }

    [Theory(DisplayName = "Lee y normaliza el correo de avisos de pedidos")]
    [InlineData("\"  Pedidos@Tienda.COM \"", "pedidos@tienda.com")]
    [InlineData("\"\"", "")]
    [InlineData("12345", "")]
    public async Task Resolve_ReadsOrdersNotificationEmail(string rawJson, string expected)
    {
        var tenantId = SetupTenant();
        SetupValues((EcommerceSettingCodes.StorefrontOrdersNotificationEmail, rawJson));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.OrdersNotificationEmail.Should().Be(expected);
    }

    [Theory(DisplayName = "Lee reserve_on_order desde booleano o texto")]
    [InlineData("true", true)]
    [InlineData("false", false)]
    [InlineData("\"false\"", false)]
    [InlineData("\"true\"", true)]
    [InlineData("\"nope\"", true)]
    [InlineData("null", true)]
    public async Task Resolve_ReadsReserveOnOrder(string rawJson, bool expected)
    {
        var tenantId = SetupTenant();
        SetupValues((EcommerceSettingCodes.StorefrontReserveOnOrder, rawJson));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.ReserveOnOrder.Should().Be(expected);
    }

    [Theory(DisplayName = "Normaliza el WhatsApp de la tienda a dígitos")]
    [InlineData("\"+593 99 999 9999\"", "593999999999")]
    [InlineData("\"(02) 2 555-1234\"", "0225551234")]
    [InlineData("\"\"", "")]
    [InlineData("12345", "")]
    public async Task Resolve_ReadsContactWhatsapp(string rawJson, string expected)
    {
        var tenantId = SetupTenant();
        SetupValues((EcommerceSettingCodes.StorefrontContactWhatsapp, rawJson));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.ContactWhatsapp.Should().Be(expected);
    }

    [Fact(DisplayName = "Filtra códigos desconocidos, deduplica y clampa costos negativos")]
    public async Task Resolve_FiltersUnknownCodesAndSanitizes()
    {
        var tenantId = SetupTenant();
        SetupValues(
            (EcommerceSettingCodes.StorefrontPaymentMethods, """["PayPal","BankTransfer","CashOnDelivery","banktransfer"]"""),
            (EcommerceSettingCodes.StorefrontShippingMethods,
                """[{"code":"Nope","cost":5},{"code":"StorePickup","cost":2.5},{"code":"Courier","cost":-3}]"""));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.PaymentMethods.Should().Equal(
            EcommercePaymentMethod.BankTransfer,
            EcommercePaymentMethod.CashOnDelivery);
        settings.ShippingMethods.Should().Equal(
            new ShippingMethodOption(EcommerceShippingMethod.StorePickup, 2.5m),
            new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m));
    }

    [Fact(DisplayName = "Si todos los códigos son inválidos vuelve a los defaults")]
    public async Task Resolve_AllUnknownCodes_ReturnsDefaults()
    {
        var tenantId = SetupTenant();
        SetupValues(
            (EcommerceSettingCodes.StorefrontPaymentMethods, """["PayPal"]"""),
            (EcommerceSettingCodes.StorefrontShippingMethods, """[{"code":"Dron","cost":1}]"""));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.PaymentMethods.Should().Equal(EcommercePaymentMethod.BankTransfer);
        settings.ShippingMethods.Should().Equal(new ShippingMethodOption(EcommerceShippingMethod.Courier, 0m));
    }

    [Theory(DisplayName = "Clampa las horas de retención al rango 1..720")]
    [InlineData("0", 1)]
    [InlineData("9999", 720)]
    [InlineData("-5", 1)]
    [InlineData("48", 48)]
    [InlineData("\"abc\"", EcommerceStorefrontSettingsReader.DefaultPaymentHoldHours)]
    public async Task Resolve_ClampsPaymentHoldHours(string rawJson, int expected)
    {
        var tenantId = SetupTenant();
        SetupValues((EcommerceSettingCodes.StorefrontPaymentHoldHours, rawJson));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.PaymentHoldHours.Should().Be(expected);
    }

    [Fact(DisplayName = "Lee y recorta las instrucciones de transferencia")]
    public async Task Resolve_ReadsBankTransferInstructions()
    {
        var tenantId = SetupTenant();
        SetupValues(
            (EcommerceSettingCodes.StorefrontBankTransferInstructions, "\"  Banco Pichincha Cta 123  \""));

        var settings = await _sut.ResolveAsync(tenantId, CancellationToken.None);

        settings.BankTransferInstructions.Should().Be("Banco Pichincha Cta 123");
    }

    private Guid SetupTenant()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
        return tenantId;
    }

    private void SetupValues(params (string Code, string Json)[] values)
    {
        var dictionary = values.ToDictionary(
            value => value.Code,
            value => JsonDocument.Parse(value.Json).RootElement.Clone(),
            StringComparer.Ordinal);

        _resolver
            .ResolveAsync(
                Arg.Any<Guid>(),
                Arg.Any<Guid>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(dictionary);
    }
}
