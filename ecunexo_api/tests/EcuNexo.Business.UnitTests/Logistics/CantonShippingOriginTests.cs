using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics;
using EcuNexo.Business.Logistics.Commands.UpsertCantonShippingRatesBulk;
using EcuNexo.Business.Logistics.Queries.CalculateShippingCost;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Logistics;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Logistics;

public sealed class CantonShippingOriginTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly Guid GuayaquilCantonId = Guid.CreateVersion7();
    private static readonly Guid QuitoCantonId = Guid.CreateVersion7();
    private static readonly Guid CuencaCantonId = Guid.CreateVersion7();
    private static readonly Guid ServientregaMethodId = Guid.CreateVersion7();

    [Fact(DisplayName = "Upsert y Calculate resuelven tarifas por cantón de origen y hacen fallback a tarifa global")]
    public async Task OriginSpecificRates_AndGlobalFallback_ResolveCorrectly()
    {
        var repo = new InMemoryCantonShippingRateRepository();
        var methods = Substitute.For<IShippingMethodRepository>();
        var geo = Substitute.For<IEcuadorGeoRepository>();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());

        var upsertHandler = new UpsertCantonShippingRatesBulkHandler(repo, methods, geo, idGen, uow);

        // 1) Tarifa específica desde Guayaquil hacia Quito ($5.50 base hasta 2kg + $1.25/kg adicional, 15% IVA)
        var guayaquilBulk = new UpsertCantonShippingRatesBulkCommand(
            TenantId,
            ServientregaMethodId,
            [
                new CantonShippingRateUpsertItem(
                    CantonId: QuitoCantonId,
                    BasePrice: 5.50m,
                    BaseWeightKg: 2m,
                    AdditionalKgPrice: 1.25m,
                    VolumetricDivisor: 6000m,
                    RoundUpExtraKg: true,
                    FreeShippingMinAmount: null,
                    TaxRate: 15m,
                    EstimatedDays: "24-48h",
                    IsEnabled: true),
            ],
            OriginCantonId: GuayaquilCantonId);

        var upsertRes = await upsertHandler.Handle(guayaquilBulk, CancellationToken.None);
        upsertRes.IsSuccess.Should().BeTrue();
        upsertRes.Value!.UpsertedCount.Should().Be(1);

        // 2) Tarifa global (sin origen específico) hacia Cuenca ($6.00 base hasta 2kg)
        var globalBulk = new UpsertCantonShippingRatesBulkCommand(
            TenantId,
            ServientregaMethodId,
            [
                new CantonShippingRateUpsertItem(
                    CantonId: CuencaCantonId,
                    BasePrice: 6.00m,
                    BaseWeightKg: 2m,
                    AdditionalKgPrice: 1.50m,
                    VolumetricDivisor: 6000m,
                    RoundUpExtraKg: true,
                    FreeShippingMinAmount: null,
                    TaxRate: 15m,
                    EstimatedDays: "48h",
                    IsEnabled: true),
            ],
            OriginCantonId: null);

        await upsertHandler.Handle(globalBulk, CancellationToken.None);

        var calcHandler = new CalculateShippingCostHandler(repo, methods, geo, new ShippingCostCalculatorFactory());

        // Consulta desde Guayaquil -> Quito (2.5 kg => 1 kg extra redondeado => 5.50 + 1.25 = 6.75 subtotal)
        var gyeToUio = await calcHandler.Handle(
            new CalculateShippingCostQuery(
                TenantId,
                CantonId: QuitoCantonId,
                ShippingMethodId: ServientregaMethodId,
                Strategy: ShippingCalculatorStrategy.WeightVolumetric,
                Items: [new ShippingPackageItem(WeightKg: 2.5m, Quantity: 1m)],
                OrderSubtotal: 40m,
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        gyeToUio.IsSuccess.Should().BeTrue();
        gyeToUio.Value!.Subtotal.Should().Be(6.75m);
        gyeToUio.Value.TaxAmount.Should().Be(1.01m);
        gyeToUio.Value.TotalPrice.Should().Be(7.76m);

        // Consulta desde Guayaquil -> Cuenca hace fallback a la tarifa global (OriginCantonId = null)
        var gyeToCue = await calcHandler.Handle(
            new CalculateShippingCostQuery(
                TenantId,
                CantonId: CuencaCantonId,
                ShippingMethodId: ServientregaMethodId,
                Strategy: ShippingCalculatorStrategy.WeightVolumetric,
                Items: [new ShippingPackageItem(WeightKg: 1.5m, Quantity: 1m)],
                OrderSubtotal: 40m,
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        gyeToCue.IsSuccess.Should().BeTrue();
        gyeToCue.Value!.Subtotal.Should().Be(6.00m);
        gyeToCue.Value.TaxAmount.Should().Be(0.90m);
        gyeToCue.Value.TotalPrice.Should().Be(6.90m);
    }

    [Fact(DisplayName = "Caso de uso pedido: suma total de productos + envío calculado desde establecimiento origen para anexar como servicio en factura")]
    public async Task OrderUseCase_WithCalculatedShippingFromOrigin_SumsTotalsForInvoiceService()
    {
        var repo = new InMemoryCantonShippingRateRepository();
        var methods = Substitute.For<IShippingMethodRepository>();
        var geo = Substitute.For<IEcuadorGeoRepository>();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());

        var upsertHandler = new UpsertCantonShippingRatesBulkHandler(repo, methods, geo, idGen, uow);
        await upsertHandler.Handle(
            new UpsertCantonShippingRatesBulkCommand(
                TenantId,
                ShippingMethodId: null,
                [
                    new CantonShippingRateUpsertItem(
                        CantonId: QuitoCantonId,
                        BasePrice: 4.50m,
                        BaseWeightKg: 2m,
                        AdditionalKgPrice: 1.25m,
                        VolumetricDivisor: 6000m,
                        RoundUpExtraKg: true,
                        FreeShippingMinAmount: null,
                        TaxRate: 15m,
                        EstimatedDays: "24-48h",
                        IsEnabled: true),
                ],
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        var calcHandler = new CalculateShippingCostHandler(repo, methods, geo, new ShippingCostCalculatorFactory());

        // Paquete de 2 unidades de 1.5 kg cada una = 3.0 kg => 1 kg extra => 4.50 + 1.25 = 5.75 (subtotal envío)
        var shippingCalc = await calcHandler.Handle(
            new CalculateShippingCostQuery(
                TenantId,
                CantonId: QuitoCantonId,
                ShippingMethodId: null,
                Strategy: ShippingCalculatorStrategy.WeightVolumetric,
                Items: [new ShippingPackageItem(WeightKg: 1.5m, Quantity: 2m)],
                OrderSubtotal: 100.00m,
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        shippingCalc.IsSuccess.Should().BeTrue();
        var shippingSubtotal = shippingCalc.Value!.Subtotal; // 5.75 (valor sin IVA del servicio de envío para anexar en factura)
        shippingSubtotal.Should().Be(5.75m);

        var customer = new EcommerceCustomerInfo(
            CustomerName: "Cliente Quito",
            TaxId: "1712345678",
            TaxIdType: "05",
            Email: "cliente@ejemplo.ec",
            Phone: "0999999999",
            Address: "Av. Amazonas N12-34");

        var shipping = new EcommerceShippingInfo(
            RecipientName: "Cliente Quito",
            RecipientPhone: "0999999999",
            AddressLine1: "Av. Amazonas N12-34",
            AddressLine2: null,
            City: "Quito",
            Province: "Pichincha",
            PostalCode: "170150",
            Carrier: "Servientrega",
            TrackingNumber: null,
            Notes: null);

        var orderResult = EcommerceOrder.Create(
            id: Guid.CreateVersion7(),
            tenantId: TenantId,
            orderNumber: "EC-0001",
            warehouseId: null,
            paymentMethod: EcommercePaymentMethod.BankTransfer,
            shippingMethod: EcommerceShippingMethod.Courier,
            customer: customer,
            shipping: shipping,
            shippingCost: shippingSubtotal,
            stockReserved: false);

        orderResult.IsSuccess.Should().BeTrue();
        var order = orderResult.Value!;
        var itemResult = EcommerceOrderItem.Create(
            Guid.CreateVersion7(),
            ecommerceOrderId: order.Id,
            catalogItemId: Guid.CreateVersion7(),
            sku: "SKU-01",
            itemName: "Prenda Everchic",
            quantity: 2m,
            unitPrice: 50.00m,
            discountAmount: 0m,
            taxRate: 0.15m);
        itemResult.IsSuccess.Should().BeTrue();
        order.AddItem(itemResult.Value!);

        // Subtotal productos = 100.00, IVA productos = 15.00, Envío (servicio) = 5.75 => Total pedido = 120.75
        order.Subtotal.Should().Be(100.00m);
        order.TaxAmount.Should().Be(15.00m);
        order.ShippingCost.Should().Be(5.75m);
        order.TotalAmount.Should().Be(120.75m);
    }

    [Fact(DisplayName = "Método InterprovincialOnly bloquea envíos a la misma provincia de origen")]
    public async Task InterprovincialOnlyMethod_BlocksSameProvince_OnUpsertAndCalculate()
    {
        var repo = new InMemoryCantonShippingRateRepository();
        var methods = Substitute.For<IShippingMethodRepository>();
        var geo = Substitute.For<IEcuadorGeoRepository>();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());

        var guayasProvinceId = Guid.CreateVersion7();
        var duranCantonId = Guid.CreateVersion7();
        var coopMethodId = Guid.CreateVersion7();

        var coop = ShippingMethod.Create(
            coopMethodId,
            TenantId,
            "ENV-002",
            "Cooperativa",
            coverageScope: ShippingCoverageScope.InterprovincialOnly).Value!;
        methods.GetByIdAsync(TenantId, coopMethodId, Arg.Any<CancellationToken>()).Returns(coop);

        var guayaquil = EcuadorCanton.Create(GuayaquilCantonId, guayasProvinceId, "0901", "Guayaquil", true, 1);
        var duran = EcuadorCanton.Create(duranCantonId, guayasProvinceId, "0907", "Durán", false, 2);
        geo.GetCantonByIdAsync(GuayaquilCantonId, Arg.Any<CancellationToken>()).Returns(guayaquil);
        geo.GetCantonByIdAsync(duranCantonId, Arg.Any<CancellationToken>()).Returns(duran);

        var upsertHandler = new UpsertCantonShippingRatesBulkHandler(repo, methods, geo, idGen, uow);
        var upsertRes = await upsertHandler.Handle(
            new UpsertCantonShippingRatesBulkCommand(
                TenantId,
                coopMethodId,
                [
                    new CantonShippingRateUpsertItem(
                        CantonId: duranCantonId,
                        BasePrice: 5.00m,
                        BaseWeightKg: 2m,
                        AdditionalKgPrice: 0m,
                        VolumetricDivisor: 6000m,
                        RoundUpExtraKg: true,
                        FreeShippingMinAmount: null,
                        TaxRate: 15m,
                        EstimatedDays: "24h",
                        IsEnabled: true),
                ],
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        upsertRes.IsFailure.Should().BeTrue();
        upsertRes.Error!.Code.Should().Be("logistics.shipping_method.interprovincial_same_province");

        var calcHandler = new CalculateShippingCostHandler(repo, methods, geo, new ShippingCostCalculatorFactory());
        var calcRes = await calcHandler.Handle(
            new CalculateShippingCostQuery(
                TenantId,
                CantonId: duranCantonId,
                ShippingMethodId: coopMethodId,
                Strategy: ShippingCalculatorStrategy.WeightVolumetric,
                Items: [new ShippingPackageItem(1m, 1m)],
                OrderSubtotal: 30m,
                OriginCantonId: GuayaquilCantonId),
            CancellationToken.None);

        calcRes.IsFailure.Should().BeTrue();
        calcRes.Error!.Code.Should().Be("logistics.shipping_method.interprovincial_same_province");
    }

    private sealed class InMemoryCantonShippingRateRepository : ICantonShippingRateRepository
    {
        public List<CantonShippingRate> Items { get; } = [];

        public Task<IReadOnlyList<CantonShippingRate>> ListByProvinceAsync(
            Guid tenantId,
            Guid provinceId,
            Guid? shippingMethodId,
            Guid? originCantonId = null,
            CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<CantonShippingRate>>(
                Items.Where(r => r.TenantId == tenantId
                    && r.ShippingMethodId == shippingMethodId
                    && r.OriginCantonId == originCantonId).ToList());

        public Task<CantonShippingRate?> GetByCantonAsync(
            Guid tenantId,
            Guid cantonId,
            Guid? shippingMethodId,
            Guid? originCantonId = null,
            CancellationToken ct = default) =>
            Task.FromResult(Items.FirstOrDefault(r =>
                r.TenantId == tenantId
                && r.CantonId == cantonId
                && r.ShippingMethodId == shippingMethodId
                && r.OriginCantonId == originCantonId));

        public Task<CantonShippingRate?> GetTrackedByCantonAsync(
            Guid tenantId,
            Guid cantonId,
            Guid? shippingMethodId,
            Guid? originCantonId = null,
            CancellationToken ct = default) =>
            GetByCantonAsync(tenantId, cantonId, shippingMethodId, originCantonId, ct);

        public Task<IReadOnlyList<CantonShippingRate>> ListTrackedByCantonsAsync(
            Guid tenantId,
            IReadOnlyCollection<Guid> cantonIds,
            Guid? shippingMethodId,
            Guid? originCantonId = null,
            CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<CantonShippingRate>>(
                Items.Where(r => r.TenantId == tenantId
                    && cantonIds.Contains(r.CantonId)
                    && r.ShippingMethodId == shippingMethodId
                    && r.OriginCantonId == originCantonId).ToList());

        public Task<IReadOnlyList<CantonShippingRate>> ListByCantonAsync(
            Guid tenantId,
            Guid cantonId,
            CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<CantonShippingRate>>(
                Items.Where(r => r.TenantId == tenantId && r.CantonId == cantonId).ToList());

        public Task<Guid?> FindPrimaryOriginCantonIdAsync(
            Guid tenantId,
            CancellationToken ct = default) =>
            Task.FromResult(
                Items.Where(r => r.TenantId == tenantId && r.IsEnabled && r.OriginCantonId.HasValue)
                    .Select(r => r.OriginCantonId)
                    .FirstOrDefault());

        public Task AddAsync(CantonShippingRate rate, CancellationToken ct)
        {
            Items.Add(rate);
            return Task.CompletedTask;
        }
    }
}
