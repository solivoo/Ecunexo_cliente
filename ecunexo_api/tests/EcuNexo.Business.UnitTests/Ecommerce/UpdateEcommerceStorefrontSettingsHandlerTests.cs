using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.UpdateEcommerceStorefrontSettings;
using EcuNexo.Business.Platform;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Platform;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class UpdateEcommerceStorefrontSettingsHandlerTests
{
    private readonly ISysSettingRepository _settings = Substitute.For<ISysSettingRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly UpdateEcommerceStorefrontSettingsValidator _validator = new();
    private readonly UpdateEcommerceStorefrontSettingsHandler _sut;

    public UpdateEcommerceStorefrontSettingsHandlerTests()
    {
        _idGenerator.NewId().Returns(_ => Guid.CreateVersion7());
        _sut = new UpdateEcommerceStorefrontSettingsHandler(_validator, _settings, _idGenerator, _unitOfWork);
    }

    [Fact(DisplayName = "Hace upsert de los cuatro settings tenant y devuelve el estado guardado")]
    public async Task Handle_WithoutExistingSettings_CreatesAll()
    {
        var tenantId = Guid.CreateVersion7();
        var scopeId = tenantId.ToString("D");
        _settings
            .GetAsync(Arg.Any<string>(), SettingScope.Tenant, scopeId, Arg.Any<CancellationToken>())
            .Returns((SysSetting?)null);

        var command = new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["BankTransfer", "CashOnDelivery"],
            [
                new UpdateEcommerceStorefrontShippingMethodInput("Courier", 4.5m),
                new UpdateEcommerceStorefrontShippingMethodInput("StorePickup", 0m),
            ],
            "  Transfiere a la cuenta 123  ",
            48,
            Guid.CreateVersion7());

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.PaymentMethods.Should().Equal("BankTransfer", "CashOnDelivery");
        dto.ShippingMethods.Should().Equal(
            new StorefrontShippingMethodSettingDto("Courier", 4.5m),
            new StorefrontShippingMethodSettingDto("StorePickup", 0m));
        dto.BankTransferInstructions.Should().Be("Transfiere a la cuenta 123");
        dto.PaymentHoldHours.Should().Be(48);

        await _settings.Received(4).AddAsync(Arg.Any<SysSetting>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Actualiza los settings existentes en lugar de duplicarlos")]
    public async Task Handle_WithExistingSettings_UpdatesRows()
    {
        var tenantId = Guid.CreateVersion7();
        var scopeId = tenantId.ToString("D");
        var rows = new Dictionary<string, SysSetting>(StringComparer.Ordinal)
        {
            [EcommerceSettingCodes.StorefrontPaymentMethods] =
                SysSetting.Create(Guid.CreateVersion7(), EcommerceSettingCodes.StorefrontPaymentMethods, "\"CreditCard\"", SettingScope.Tenant, scopeId).Value!,
            [EcommerceSettingCodes.StorefrontShippingMethods] =
                SysSetting.Create(Guid.CreateVersion7(), EcommerceSettingCodes.StorefrontShippingMethods, "[]", SettingScope.Tenant, scopeId).Value!,
            [EcommerceSettingCodes.StorefrontBankTransferInstructions] =
                SysSetting.Create(Guid.CreateVersion7(), EcommerceSettingCodes.StorefrontBankTransferInstructions, "\"\"", SettingScope.Tenant, scopeId).Value!,
            [EcommerceSettingCodes.StorefrontPaymentHoldHours] =
                SysSetting.Create(Guid.CreateVersion7(), EcommerceSettingCodes.StorefrontPaymentHoldHours, "24", SettingScope.Tenant, scopeId).Value!,
        };

        _settings
            .GetAsync(Arg.Any<string>(), SettingScope.Tenant, scopeId, Arg.Any<CancellationToken>())
            .Returns(call => rows.TryGetValue(call.ArgAt<string>(0), out var row) ? row : null);

        var command = new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["BankTransfer"],
            [new UpdateEcommerceStorefrontShippingMethodInput("Courier", 0m)],
            string.Empty,
            72);

        var result = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _settings.DidNotReceive().AddAsync(Arg.Any<SysSetting>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        rows[EcommerceSettingCodes.StorefrontPaymentMethods].ValueJson.Should().Contain("BankTransfer");
        rows[EcommerceSettingCodes.StorefrontShippingMethods].ValueJson.Should().Contain("Courier");
        rows[EcommerceSettingCodes.StorefrontPaymentHoldHours].ValueJson.Should().Be("72");
    }

    [Fact(DisplayName = "El validador rechaza métodos vacíos, costos negativos y hold fuera de rango")]
    public async Task Validator_RejectsInvalidPayloads()
    {
        var tenantId = Guid.CreateVersion7();

        var withoutPayments = await _validator.ValidateAsync(new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            [],
            [new UpdateEcommerceStorefrontShippingMethodInput("Courier", 0m)],
            null,
            24));
        withoutPayments.IsValid.Should().BeFalse();

        var withoutShipping = await _validator.ValidateAsync(new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["BankTransfer"],
            [],
            null,
            24));
        withoutShipping.IsValid.Should().BeFalse();

        var negativeCost = await _validator.ValidateAsync(new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["BankTransfer"],
            [new UpdateEcommerceStorefrontShippingMethodInput("Courier", -1m)],
            null,
            24));
        negativeCost.IsValid.Should().BeFalse();

        var invalidHold = await _validator.ValidateAsync(new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["BankTransfer"],
            [new UpdateEcommerceStorefrontShippingMethodInput("Courier", 0m)],
            null,
            0));
        invalidHold.IsValid.Should().BeFalse();

        var unknownCode = await _validator.ValidateAsync(new UpdateEcommerceStorefrontSettingsCommand(
            tenantId,
            ["PayPal"],
            [new UpdateEcommerceStorefrontShippingMethodInput("Dron", 0m)],
            null,
            24));
        unknownCode.IsValid.Should().BeFalse();
    }
}
