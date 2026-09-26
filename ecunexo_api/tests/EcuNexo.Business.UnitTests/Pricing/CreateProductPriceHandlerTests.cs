using EcuNexo.Business.Catalog;
using EcuNexo.Business.Pricing.Commands.CreateProductPrice;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class CreateProductPriceHandlerTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Una vigencia futura cierra la vigencia abierta anterior y registra historial")]
    public async Task Handle_FutureValidity_ClosesPreviousOpenEndedPrice()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        var existing = Price(tenantId, list.Id, item.Id, 10m);
        prices.Seed(existing);
        var history = new InMemoryPriceChangeLogRepository();
        var unitOfWork = new InMemoryUnitOfWork();
        var handler = Handler(lists, prices, history, unitOfWork, ItemRepository(item));

        var result = await handler.Handle(
            new CreateProductPriceCommand(
                tenantId,
                list.Id,
                item.Id,
                12m,
                Today.AddDays(30),
                null,
                "Ajuste de precio"),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        existing.ValidTo.Should().Be(Today.AddDays(29));
        history.Entries.Should().ContainSingle();
        history.Entries[0].PreviousPrice.Should().Be(10m);
        history.Entries[0].NewPrice.Should().Be(12m);
        unitOfWork.SaveCount.Should().Be(1);
    }

    [Fact(DisplayName = "Una vigencia superpuesta con un precio acotado es rechazada")]
    public async Task Handle_OverlappingBoundedValidity_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, item.Id, 10m, validTo: Today.AddDays(60)));
        var handler = Handler(lists, prices, new InMemoryPriceChangeLogRepository(), new InMemoryUnitOfWork(), ItemRepository(item));

        var result = await handler.Handle(
            new CreateProductPriceCommand(
                tenantId,
                list.Id,
                item.Id,
                12m,
                Today.AddDays(10),
                null,
                null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price.overlap");
    }

    [Fact(DisplayName = "Un producto inexistente no admite precio")]
    public async Task Handle_ItemNotFound_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId);
        lists.Seed(list);
        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdAsync(tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);
        var handler = Handler(lists, new InMemoryProductPriceRepository(), new InMemoryPriceChangeLogRepository(), new InMemoryUnitOfWork(), items);

        var result = await handler.Handle(
            new CreateProductPriceCommand(tenantId, list.Id, Guid.CreateVersion7(), 10m, Today, null, null),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.item.not_found");
    }

    private static CreateProductPriceHandler Handler(
        InMemoryPriceListRepository lists,
        InMemoryProductPriceRepository prices,
        InMemoryPriceChangeLogRepository history,
        InMemoryUnitOfWork unitOfWork,
        ICatalogItemRepository items)
    {
        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        return new CreateProductPriceHandler(
            ids,
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            lists,
            prices,
            history,
            items,
            unitOfWork);
    }

    private static ICatalogItemRepository ItemRepository(CatalogItem item)
    {
        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdAsync(item.TenantId, item.Id, Arg.Any<CancellationToken>()).Returns(item);
        return items;
    }

    private static CatalogItem Physical(Guid tenantId) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Aceite 10W40",
            description: null,
            sku: $"SKU-{Guid.NewGuid():N}"[..12],
            basePrice: null,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

    private static PriceList List(Guid tenantId) =>
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

    private static ProductPrice Price(
        Guid tenantId,
        Guid priceListId,
        Guid itemId,
        decimal price,
        DateOnly? validTo = null) =>
        ProductPrice.Create(
            Guid.CreateVersion7(),
            tenantId,
            priceListId,
            itemId,
            price,
            Today,
            validTo).Value!;
}
