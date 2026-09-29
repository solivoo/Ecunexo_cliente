using EcuNexo.Business.Pricing.Commands.AssignVolumeDiscountScheme;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class AssignVolumeDiscountSchemeHandlerTests
{
    private static readonly Guid TenantId = Guid.CreateVersion7();
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);

    [Fact(DisplayName = "Asigna masivamente el esquema a los precios vigentes de los productos")]
    public async Task Handle_ValidAssignment_AssignsSchemeToPrices()
    {
        var priceLists = new InMemoryPriceListRepository();
        var defaultList = PriceList.Create(
            Guid.CreateVersion7(),
            TenantId,
            "PUBLICO",
            "General",
            null,
            null,
            false,
            Today.AddDays(-10),
            null,
            0,
            isDefault: true).Value!;
        priceLists.Seed(defaultList);

        var schemes = new InMemoryVolumeDiscountSchemeRepository();
        var scheme = VolumeDiscountScheme.Create(
            Guid.CreateVersion7(),
            TenantId,
            "Escala Calcetines",
            null,
            VolumeDiscountSchemeType.Percentage).Value!;
        schemes.Seed(scheme);

        var item1 = Guid.CreateVersion7();
        var item2 = Guid.CreateVersion7();

        var productPrices = new InMemoryProductPriceRepository();
        var price1 = ProductPrice.Create(Guid.CreateVersion7(), TenantId, defaultList.Id, item1, 3m, Today.AddDays(-5), null).Value!;
        var price2 = ProductPrice.Create(Guid.CreateVersion7(), TenantId, defaultList.Id, item2, 4m, Today.AddDays(-5), null).Value!;
        productPrices.Seed(price1);
        productPrices.Seed(price2);

        var uow = new InMemoryUnitOfWork();
        var handler = new AssignVolumeDiscountSchemeHandler(
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            priceLists,
            productPrices,
            schemes,
            uow);

        var command = new AssignVolumeDiscountSchemeCommand(
            TenantId,
            defaultList.Id,
            scheme.Id,
            [item1, item2]);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AssignedCount.Should().Be(2);
        price1.VolumeDiscountSchemeId.Should().Be(scheme.Id);
        price2.VolumeDiscountSchemeId.Should().Be(scheme.Id);
        uow.SaveCount.Should().Be(1);
    }

    [Fact(DisplayName = "Falla si el esquema especificado no existe o está inactivo")]
    public async Task Handle_NonExistentScheme_Fails()
    {
        var priceLists = new InMemoryPriceListRepository();
        var defaultList = PriceList.Create(
            Guid.CreateVersion7(),
            TenantId,
            "PUBLICO",
            "General",
            null,
            null,
            false,
            Today.AddDays(-10),
            null,
            0,
            isDefault: true).Value!;
        priceLists.Seed(defaultList);

        var schemes = new InMemoryVolumeDiscountSchemeRepository();
        var productPrices = new InMemoryProductPriceRepository();
        var uow = new InMemoryUnitOfWork();
        var handler = new AssignVolumeDiscountSchemeHandler(
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            priceLists,
            productPrices,
            schemes,
            uow);

        var command = new AssignVolumeDiscountSchemeCommand(
            TenantId,
            defaultList.Id,
            Guid.CreateVersion7(),
            [Guid.CreateVersion7()]);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.volume_scheme.not_found");
    }
}
