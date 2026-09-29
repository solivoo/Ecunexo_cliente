using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics;
using EcuNexo.Business.Logistics.Commands.CreateShippingRateRule;
using EcuNexo.Business.Logistics.Commands.DeleteShippingRateRule;
using EcuNexo.Business.Logistics.Commands.UpdateShippingRateRule;
using EcuNexo.Business.Logistics.Queries.ResolveShippingRates;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Logistics;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Logistics;

public sealed class ShippingRateRuleHandlerTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();

    [Fact(DisplayName = "CreateShippingRateRule crea y guarda una regla válida")]
    public async Task Create_ValidInput_Success()
    {
        var repo = new InMemoryShippingRateRuleRepository();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        var expectedId = Guid.CreateVersion7();
        idGen.NewId().Returns(expectedId);
        var caller = Substitute.For<ICallerContext>();
        caller.UserId.Returns(Guid.NewGuid());

        var handler = new CreateShippingRateRuleHandler(idGen, caller, repo, uow);

        var input = new CreateShippingRateRuleInput(
            Carrier: "Servientrega",
            Zone: "Provincia",
            Name: "Servientrega Provincia",
            Price: 6.00m,
            MinQuantity: 1m,
            TaxRate: 15m,
            EstimatedDays: "24-48 horas");

        var result = await handler.Handle(new CreateShippingRateRuleCommand(TenantId, input), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(expectedId);
        result.Value.Carrier.Should().Be("Servientrega");
        result.Value.Price.Should().Be(6.00m);
        result.Value.TaxRate.Should().Be(15m);
        repo.Items.Should().ContainSingle();
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateShippingRateRule falla con datos inválidos")]
    public async Task Create_InvalidInput_Fails()
    {
        var repo = new InMemoryShippingRateRuleRepository();
        var uow = Substitute.For<IUnitOfWork>();
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(Guid.NewGuid());
        var caller = Substitute.For<ICallerContext>();

        var handler = new CreateShippingRateRuleHandler(idGen, caller, repo, uow);

        var input = new CreateShippingRateRuleInput(
            Carrier: "",
            Zone: "Provincia",
            Name: "Test",
            Price: -10m);

        var result = await handler.Handle(new CreateShippingRateRuleCommand(TenantId, input), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        repo.Items.Should().BeEmpty();
        await uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "UpdateShippingRateRule actualiza valores y estado")]
    public async Task Update_ExistingRule_Success()
    {
        var ruleId = Guid.CreateVersion7();
        var initialRule = ShippingRateRule.Create(
            ruleId,
            TenantId,
            "Local",
            "Local",
            "Entrega Local",
            3.00m,
            minQuantity: 1m).Value!;

        var repo = new InMemoryShippingRateRuleRepository();
        repo.Items.Add(initialRule);
        var uow = Substitute.For<IUnitOfWork>();
        var caller = Substitute.For<ICallerContext>();

        var handler = new UpdateShippingRateRuleHandler(caller, repo, uow);

        var updateInput = new UpdateShippingRateRuleInput(
            Carrier: "Local Express",
            Zone: "Local",
            Name: "Entrega Inmediata Moto",
            Price: 3.50m,
            MinQuantity: 1m,
            IsActive: true);

        var result = await handler.Handle(new UpdateShippingRateRuleCommand(TenantId, ruleId, updateInput), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Carrier.Should().Be("Local Express");
        result.Value.Price.Should().Be(3.50m);
        initialRule.Carrier.Should().Be("Local Express");
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "DeleteShippingRateRule elimina la regla")]
    public async Task Delete_ExistingRule_RemovesFromRepo()
    {
        var ruleId = Guid.CreateVersion7();
        var initialRule = ShippingRateRule.Create(
            ruleId,
            TenantId,
            "Local",
            "Local",
            "Entrega Local",
            3.00m).Value!;

        var repo = new InMemoryShippingRateRuleRepository();
        repo.Items.Add(initialRule);
        var uow = Substitute.For<IUnitOfWork>();

        var handler = new DeleteShippingRateRuleHandler(repo, uow);

        var result = await handler.Handle(new DeleteShippingRateRuleCommand(TenantId, ruleId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        repo.Items.Should().BeEmpty();
        await uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "ResolveShippingRates resuelve tarifas y recomienda la mejor por volumen")]
    public async Task Resolve_WithVolumeThreshold_RecommendsCorrectTier()
    {
        var repo = new InMemoryShippingRateRuleRepository();
        repo.Items.AddRange([
            ShippingRateRule.Create(Guid.NewGuid(), TenantId, "Servientrega", "Provincia", "Servientrega Provincia", 6.00m, minQuantity: 1m, taxRate: 15m, sortOrder: 1).Value!,
            ShippingRateRule.Create(Guid.NewGuid(), TenantId, "Cooperativa", "Provincia", "Cooperativa a partir de 36u", 6.00m, minQuantity: 36m, sortOrder: 2, notes: "Flete pesado por bulto").Value!
        ]);

        var handler = new ResolveShippingRatesHandler(repo);

        // Caso 1: Pedido de 24 unidades (faltan 12 para Cooperativa)
        var query24 = new ResolveShippingRatesQuery(TenantId, new ResolveShippingRatesInput("Provincia", 24m, 120m));
        var result24 = await handler.Handle(query24, CancellationToken.None);

        result24.IsSuccess.Should().BeTrue();
        result24.Value!.Should().HaveCount(2);

        var servientrega24 = result24.Value!.First(o => o.Carrier == "Servientrega");
        servientrega24.IsEligible.Should().BeTrue();
        servientrega24.IsRecommended.Should().BeTrue();
        servientrega24.TotalPrice.Should().Be(6.90m); // 6 + 15% IVA = 6.90

        var coop24 = result24.Value!.First(o => o.Carrier == "Cooperativa");
        coop24.IsEligible.Should().BeFalse();
        coop24.UnitsNeeded.Should().Be(12m);

        // Caso 2: Pedido de 36 unidades (califica para Cooperativa)
        var query36 = new ResolveShippingRatesQuery(TenantId, new ResolveShippingRatesInput("Provincia", 36m, 180m));
        var result36 = await handler.Handle(query36, CancellationToken.None);

        result36.IsSuccess.Should().BeTrue();
        var coop36 = result36.Value!.First(o => o.Carrier == "Cooperativa");
        coop36.IsEligible.Should().BeTrue();
        coop36.IsRecommended.Should().BeTrue();
        coop36.UnitsNeeded.Should().BeNull();
    }

    private sealed class InMemoryShippingRateRuleRepository : IShippingRateRuleRepository
    {
        public List<ShippingRateRule> Items { get; } = [];

        public Task AddAsync(ShippingRateRule rule, CancellationToken ct)
        {
            Items.Add(rule);
            return Task.CompletedTask;
        }

        public Task<ShippingRateRule?> GetByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct) =>
            Task.FromResult(Items.FirstOrDefault(r => r.TenantId == tenantId && r.Id == ruleId));

        public Task<ShippingRateRule?> GetTrackedByIdAsync(Guid tenantId, Guid ruleId, CancellationToken ct) =>
            Task.FromResult(Items.FirstOrDefault(r => r.TenantId == tenantId && r.Id == ruleId));

        public Task<IReadOnlyList<ShippingRateRule>> ListAsync(
            Guid tenantId,
            string? carrier,
            string? zone,
            bool onlyActive,
            CancellationToken ct)
        {
            IEnumerable<ShippingRateRule> query = Items.Where(r => r.TenantId == tenantId);
            if (onlyActive)
            {
                query = query.Where(r => r.IsActive);
            }

            if (!string.IsNullOrWhiteSpace(carrier))
            {
                query = query.Where(r => r.Carrier.Contains(carrier, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(zone))
            {
                query = query.Where(r => r.Zone.Contains(zone, StringComparison.OrdinalIgnoreCase));
            }
            return Task.FromResult<IReadOnlyList<ShippingRateRule>>(query.ToList());
        }

        public Task<IReadOnlyList<ShippingRateRule>> ListActiveForResolutionAsync(
            Guid tenantId,
            string? zone,
            CancellationToken ct)
        {
            var query = Items.Where(r => r.TenantId == tenantId && r.IsActive);
            if (!string.IsNullOrWhiteSpace(zone))
            {
                query = query.Where(r => r.Zone == "*" || r.Zone.Equals(zone, StringComparison.OrdinalIgnoreCase));
            }
            return Task.FromResult<IReadOnlyList<ShippingRateRule>>(query.ToList());
        }

        public void Remove(ShippingRateRule rule)
        {
            Items.Remove(rule);
        }
    }
}
