using EcuNexo.Business.Pricing.Commands.CreatePriceList;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class CreatePriceListHandlerTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "No puede existir más de una lista predeterminada activa")]
    public async Task Handle_DefaultConflict_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var lists = new InMemoryPriceListRepository();
        lists.Seed(CreateDefault(tenantId));
        var handler = Handler(lists, new InMemoryUnitOfWork());

        var result = await handler.Handle(
            new CreatePriceListCommand(tenantId, "MAYORISTA", "Mayorista", null, null, false, Today, null, 0, IsDefault: true),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.default.conflict");
    }

    [Fact(DisplayName = "Una lista válida se crea normalizando el código")]
    public async Task Handle_ValidList_NormalizesCode()
    {
        var tenantId = Guid.CreateVersion7();
        var lists = new InMemoryPriceListRepository();
        var unitOfWork = new InMemoryUnitOfWork();
        var handler = Handler(lists, unitOfWork);

        var result = await handler.Handle(
            new CreatePriceListCommand(tenantId, " publico ", "Precio público", null, null, false, Today, null, 0, IsDefault: true),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        lists.Items.Should().ContainSingle();
        lists.Items[0].Code.Should().Be("PUBLICO");
        lists.Items[0].IsDefault.Should().BeTrue();
        unitOfWork.SaveCount.Should().Be(1);
    }

    private static CreatePriceListHandler Handler(
        InMemoryPriceListRepository lists,
        InMemoryUnitOfWork unitOfWork)
    {
        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        return new CreatePriceListHandler(
            ids,
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            lists,
            unitOfWork);
    }

    private static PriceList CreateDefault(Guid tenantId) =>
        PriceList.Create(
            Guid.CreateVersion7(),
            tenantId,
            "PUBLICO",
            "Precio público",
            null,
            null,
            pricesIncludeTax: false,
            Today,
            null,
            priority: 0,
            isDefault: true).Value!;
}
