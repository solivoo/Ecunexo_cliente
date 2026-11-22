using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Logistics;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Logistics;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Ecommerce;

public sealed class StorefrontShippingServiceTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IShippingMethodRepository _methods = Substitute.For<IShippingMethodRepository>();
    private readonly ICantonShippingRateRepository _rates = Substitute.For<ICantonShippingRateRepository>();
    private readonly IEcuadorGeoRepository _geo = Substitute.For<IEcuadorGeoRepository>();
    private readonly IEcommerceStorefrontSettingsReader _settings = Substitute.For<IEcommerceStorefrontSettingsReader>();
    private readonly IShippingCostCalculatorFactory _calculatorFactory = new ShippingCostCalculatorFactory();
    private readonly StorefrontShippingService _sut;

    public StorefrontShippingServiceTests()
    {
        _sut = new StorefrontShippingService(
            _tenants,
            _methods,
            _rates,
            _geo,
            _settings,
            _calculatorFactory);

        _settings.ResolveAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new EcommerceStorefrontSettings(
                PaymentMethods: [EcommercePaymentMethod.BankTransfer],
                ShippingMethods:
                [
                    new ShippingMethodOption(EcommerceShippingMethod.Courier, 5m),
                    new ShippingMethodOption(EcommerceShippingMethod.StorePickup, 0m),
                ],
                BankTransferInstructions: string.Empty,
                PaymentHoldHours: 24));
    }

    [Fact]
    public async Task ListOptionsForCanton_OmitsInterprovincialMethod_WhenSameProvince()
    {
        var tenantId = Guid.NewGuid();
        var guayasId = Guid.NewGuid();
        var guayaquil = EcuadorCanton.Create(Guid.NewGuid(), guayasId, "0901", "Guayaquil", true, 1);

        var servientrega = ShippingMethod.Create(
            Guid.NewGuid(), tenantId, "ENV-001", "Servientrega", "Courier nacional", "24 a 48 horas", 1,
            coverageScope: ShippingCoverageScope.National).Value!;
        var cooperativa = ShippingMethod.Create(
            Guid.NewGuid(), tenantId, "ENV-002", "Cooperativa", "Envío interprovincial", "24 horas", 2,
            coverageScope: ShippingCoverageScope.InterprovincialOnly).Value!;

        var rateServi = CantonShippingRate.Create(
            Guid.NewGuid(), tenantId, guayaquil.Id, servientrega.Id,
            basePrice: 3.50m, baseWeightKg: 2m, additionalKgPrice: 1m,
            volumetricDivisor: 5000m, roundUpExtraKg: true, freeShippingMinAmount: null, taxRate: 0m,
            estimatedDays: "24h", isEnabled: true,
            originCantonId: guayaquil.Id).Value!;
        var rateCoop = CantonShippingRate.Create(
            Guid.NewGuid(), tenantId, guayaquil.Id, cooperativa.Id,
            basePrice: 4.00m, baseWeightKg: 5m, additionalKgPrice: 0.50m,
            volumetricDivisor: 5000m, roundUpExtraKg: true, freeShippingMinAmount: null, taxRate: 0m,
            estimatedDays: "24h", isEnabled: true,
            originCantonId: guayaquil.Id).Value!;

        _rates.FindPrimaryOriginCantonIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(guayaquil.Id);
        _geo.GetCantonByIdAsync(guayaquil.Id, Arg.Any<CancellationToken>()).Returns(guayaquil);
        _methods.ListAsync(tenantId, true, Arg.Any<CancellationToken>()).Returns([servientrega, cooperativa]);
        _rates.ListByCantonAsync(tenantId, guayaquil.Id, Arg.Any<CancellationToken>()).Returns([rateServi, rateCoop]);

        var options = await _sut.ListOptionsForCantonAsync(tenantId, guayaquil.Id, 20m, CancellationToken.None);

        options.Should().ContainSingle(o => o.ShippingMethodId == servientrega.Id && o.Cost == 3.50m);
        options.Should().NotContain(o => o.ShippingMethodId == cooperativa.Id);
        options.Should().Contain(o => o.Code == "StorePickup" && o.Cost == 0m);
    }

    [Fact]
    public async Task ListOptionsForCanton_IncludesInterprovincialAndAppliesFreeShipping_WhenOtherProvince()
    {
        var tenantId = Guid.NewGuid();
        var guayasId = Guid.NewGuid();
        var pichinchaId = Guid.NewGuid();
        var guayaquil = EcuadorCanton.Create(Guid.NewGuid(), guayasId, "0901", "Guayaquil", true, 1);
        var quito = EcuadorCanton.Create(Guid.NewGuid(), pichinchaId, "1701", "Quito", true, 1);

        var cooperativa = ShippingMethod.Create(
            Guid.NewGuid(), tenantId, "ENV-002", "Cooperativa", "Envío interprovincial", "24 a 48 horas", 1,
            coverageScope: ShippingCoverageScope.InterprovincialOnly).Value!;

        var rateCoop = CantonShippingRate.Create(
            Guid.NewGuid(), tenantId, quito.Id, cooperativa.Id,
            basePrice: 5.00m, baseWeightKg: 2m, additionalKgPrice: 1m,
            volumetricDivisor: 5000m, roundUpExtraKg: true, freeShippingMinAmount: 50m, taxRate: 0m,
            estimatedDays: "24 a 48 horas", isEnabled: true,
            originCantonId: guayaquil.Id).Value!;

        _rates.FindPrimaryOriginCantonIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(guayaquil.Id);
        _geo.GetCantonByIdAsync(guayaquil.Id, Arg.Any<CancellationToken>()).Returns(guayaquil);
        _geo.GetCantonByIdAsync(quito.Id, Arg.Any<CancellationToken>()).Returns(quito);
        _methods.ListAsync(tenantId, true, Arg.Any<CancellationToken>()).Returns([cooperativa]);
        _rates.ListByCantonAsync(tenantId, quito.Id, Arg.Any<CancellationToken>()).Returns([rateCoop]);

        var paidOptions = await _sut.ListOptionsForCantonAsync(tenantId, quito.Id, 25m, CancellationToken.None);
        paidOptions.Should().ContainSingle(o => o.ShippingMethodId == cooperativa.Id && o.Cost == 5.00m && !o.IsFreeShipping);

        var freeOptions = await _sut.ListOptionsForCantonAsync(tenantId, quito.Id, 60m, CancellationToken.None);
        freeOptions.Should().ContainSingle(o => o.ShippingMethodId == cooperativa.Id && o.Cost == 0m && o.IsFreeShipping);
    }

    [Fact]
    public async Task ResolveAndValidate_RejectsInterprovincial_WhenSameProvince()
    {
        var tenantId = Guid.NewGuid();
        var guayasId = Guid.NewGuid();
        var guayaquil = EcuadorCanton.Create(Guid.NewGuid(), guayasId, "0901", "Guayaquil", true, 1);
        var cooperativa = ShippingMethod.Create(
            Guid.NewGuid(), tenantId, "ENV-002", "Cooperativa", null, null, 1,
            coverageScope: ShippingCoverageScope.InterprovincialOnly).Value!;

        _methods.GetByIdAsync(tenantId, cooperativa.Id, Arg.Any<CancellationToken>()).Returns(cooperativa);
        _rates.FindPrimaryOriginCantonIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(guayaquil.Id);
        _geo.GetCantonByIdAsync(guayaquil.Id, Arg.Any<CancellationToken>()).Returns(guayaquil);

        var result = await _sut.ResolveAndValidateAsync(tenantId, guayaquil.Id, cooperativa.Id, 20m, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("logistics.shipping_method.interprovincial_same_province");
    }
}
