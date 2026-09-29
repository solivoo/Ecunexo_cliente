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
