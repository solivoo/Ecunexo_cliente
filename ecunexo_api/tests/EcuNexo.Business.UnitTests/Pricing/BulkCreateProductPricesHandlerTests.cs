using EcuNexo.Business.Catalog;
using EcuNexo.Business.Pricing.Commands.BulkCreateProductPrices;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class BulkCreateProductPricesHandlerTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Carga masiva crea precios, cierra la vigencia anterior y registra historial")]
    public async Task Handle_Bulk_CreatesClosesAndLogs()
    {
        var tenantId = Guid.CreateVersion7();
        var itemA = Physical(tenantId);
        var itemB = Physical(tenantId);
        var list = List(tenantId);
        var lists = new InMemoryPriceListRepository();
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        var previous = Price(tenantId, list.Id, itemA.Id, 10m);
        prices.Seed(previous);
        var history = new InMemoryPriceChangeLogRepository();
        var unitOfWork = new InMemoryUnitOfWork();
        var handler = Handler(lists, prices, history, unitOfWork, Items(itemA, itemB));

        var result = await handler.Handle(
            new BulkCreateProductPricesCommand(
                tenantId,
                list.Id,
                Today.AddDays(1),
                null,
                "Carga masiva de temporada",
                [new BulkPriceItemInput(itemA.Id, 12m), new BulkPriceItemInput(itemB.Id, 20m)]),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.CreatedCount.Should().Be(2);
        previous.ValidTo.Should().Be(Today);
        history.Entries.Should().HaveCount(2);
        unitOfWork.SaveCount.Should().Be(1);
    }

    [Fact(DisplayName = "Carga masiva rechaza productos repetidos")]
    public async Task Handle_DuplicatedItem_FailsValidation()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var list = List(tenantId);
        var lists = new InMemoryPriceListRepository();
        lists.Seed(list);
        var handler = Handler(
            lists,
            new InMemoryProductPriceRepository(),
            new InMemoryPriceChangeLogRepository(),
            new InMemoryUnitOfWork(),
            Items(item));

        var result = await handler.Handle(
            new BulkCreateProductPricesCommand(
                tenantId,
                list.Id,
                Today,
                null,
                null,
                [new BulkPriceItemInput(item.Id, 10m), new BulkPriceItemInput(item.Id, 11m)]),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.bulk.validation");
    }

    [Fact(DisplayName = "Carga masiva falla si un producto no existe o está inactivo")]
    public async Task Handle_MissingItem_FailsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var list = List(tenantId);
        var lists = new InMemoryPriceListRepository();
        lists.Seed(list);
        var handler = Handler(
            lists,
            new InMemoryProductPriceRepository(),
            new InMemoryPriceChangeLogRepository(),
            new InMemoryUnitOfWork(),
            Items(item));

        var result = await handler.Handle(
            new BulkCreateProductPricesCommand(
                tenantId,
                list.Id,
                Today,
                null,
                null,
                [new BulkPriceItemInput(Guid.CreateVersion7(), 10m)]),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.bulk.item_not_found");
    }

    private static BulkCreateProductPricesHandler Handler(
        InMemoryPriceListRepository lists,
        InMemoryProductPriceRepository prices,
        InMemoryPriceChangeLogRepository history,
        InMemoryUnitOfWork unitOfWork,
        ICatalogItemRepository items)
    {
        var ids = Substitute.For<IIdGenerator>();
        ids.NewId().Returns(_ => Guid.CreateVersion7());
        return new BulkCreateProductPricesHandler(
            new BulkCreateProductPricesValidator(),
            ids,
            new TestCallerContext { UserId = Guid.CreateVersion7() },
            lists,
            prices,
            history,
            items,
            unitOfWork);
    }

    private static ICatalogItemRepository Items(params CatalogItem[] items)
    {
        var repo = Substitute.For<ICatalogItemRepository>();
        repo.GetActiveByIdsAsync(
                Arg.Any<Guid>(),
                Arg.Any<IReadOnlyList<Guid>>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                var ids = callInfo.Arg<IReadOnlyList<Guid>>();
                return items.Where(i => ids.Contains(i.Id)).ToList();
            });
        return repo;
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

    private static ProductPrice Price(Guid tenantId, Guid priceListId, Guid itemId, decimal price) =>
        ProductPrice.Create(
            Guid.CreateVersion7(),
            tenantId,
            priceListId,
            itemId,
            price,
            Today,
            null).Value!;
}
