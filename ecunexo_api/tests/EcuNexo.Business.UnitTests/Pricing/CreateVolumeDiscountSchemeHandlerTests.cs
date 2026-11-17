using EcuNexo.Business.Pricing;
using EcuNexo.Business.Pricing.Commands.CreateVolumeDiscountScheme;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class CreateVolumeDiscountSchemeHandlerTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();

    [Fact(DisplayName = "Crea un esquema de volumen correctamente con sus escalones")]
    public async Task Handle_ValidScheme_CreatesAndSaves()
    {
        var schemes = new InMemoryVolumeDiscountSchemeRepository();
        var uow = new InMemoryUnitOfWork();
        var handler = CreateHandler(schemes, uow);

        var tiers = new List<VolumeDiscountTierInput>
        {
            new(6m, 11m, 15m),
            new(12m, null, 25m),
        };

        var command = new CreateVolumeDiscountSchemeCommand(
            TenantId,
            "Escala Calcetines",
            "Mayorista",
            VolumeDiscountSchemeType.Percentage,
            tiers);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        schemes.Items.Should().ContainSingle();
        var saved = schemes.Items[0];
        saved.Name.Should().Be("Escala Calcetines");
        saved.Type.Should().Be(VolumeDiscountSchemeType.Percentage);
        saved.Tiers.Should().HaveCount(2);
        uow.SaveCount.Should().Be(1);
    }

    [Fact(DisplayName = "Falla si ya existe un esquema con el mismo nombre")]
    public async Task Handle_DuplicateName_Fails()
    {
        var schemes = new InMemoryVolumeDiscountSchemeRepository();
        schemes.Seed(VolumeDiscountScheme.Create(
            Guid.CreateVersion7(),
            TenantId,
            "Escala Calcetines",
            null,
            VolumeDiscountSchemeType.Percentage).Value!);

        var uow = new InMemoryUnitOfWork();
        var handler = CreateHandler(schemes, uow);

        var command = new CreateVolumeDiscountSchemeCommand(
            TenantId,
            "escala calcetines",
            null,
            VolumeDiscountSchemeType.Percentage);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_scheme.name.duplicate");
        uow.SaveCount.Should().Be(0);
    }

    [Fact(DisplayName = "Crea un esquema agrupado PackagePrice con targets de inclusión y exclusión")]
    public async Task Handle_GroupedPackagePriceWithTargets_CreatesAndSaves()
    {
        var schemes = new InMemoryVolumeDiscountSchemeRepository();
        var uow = new InMemoryUnitOfWork();
        var handler = CreateHandler(schemes, uow);

        var categoryId = Guid.CreateVersion7();
        var excludedProductId = Guid.CreateVersion7();

        var command = new CreateVolumeDiscountSchemeCommand(
            TenantId,
            "Pack Calcetines",
            "5 por $15 y 12 por $34",
            VolumeDiscountSchemeType.PackagePrice,
            [
                new(5m, 11m, 15m),
                new(12m, null, 34m),
            ],
            GroupingMode: VolumeGroupingMode.PerGroup,
            MinGroupQuantity: 5m,
            EnforceMinPurchase: false,
            Priority: 10,
            Targets:
            [
                new(VolumeRuleTargetType.Category, categoryId.ToString(), IsExclusion: false),
                new(VolumeRuleTargetType.Product, excludedProductId.ToString(), IsExclusion: true),
            ]);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var saved = schemes.Items.Should().ContainSingle().Subject;
        saved.GroupingMode.Should().Be(VolumeGroupingMode.PerGroup);
        saved.MinGroupQuantity.Should().Be(5m);
        saved.EnforceMinPurchase.Should().BeFalse();
        saved.Priority.Should().Be(10);
        saved.Targets.Should().HaveCount(2);
        saved.Targets.Should().Contain(t => t.TargetType == VolumeRuleTargetType.Category && t.TargetReference == categoryId.ToString() && !t.IsExclusion);
        saved.Targets.Should().Contain(t => t.TargetType == VolumeRuleTargetType.Product && t.TargetReference == excludedProductId.ToString() && t.IsExclusion);
    }

    private static CreateVolumeDiscountSchemeHandler CreateHandler(
        InMemoryVolumeDiscountSchemeRepository schemes,
        InMemoryUnitOfWork uow)
    {
        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());

        return new CreateVolumeDiscountSchemeHandler(
            ids,
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            schemes,
            uow);
    }
}
