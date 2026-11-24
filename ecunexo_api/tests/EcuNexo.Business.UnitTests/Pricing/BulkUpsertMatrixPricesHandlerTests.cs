using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Pricing.Commands.BulkUpsertMatrixPrices;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class BulkUpsertMatrixPricesHandlerTests
{
    private static readonly DateOnly Today = new(2026, 11, 23);

    [Fact(DisplayName = "Matrix bulk-upsert actualiza vigentes con misma fecha, cierra anteriores y crea nuevos en 1 transacción")]
    public async Task Handle_MultiListUpsert_UpdatesCreatesClosesAndLogsInSingleSave()
    {
        var tenantId = Guid.CreateVersion7();
        var itemA = Physical(tenantId, "Producto A", "SKU-A");
        var itemB = Physical(tenantId, "Producto B", "SKU-B");
        var listPublic = PriceList.Create(Guid.CreateVersion7(), tenantId, "PVP", "Público", null, "USD", true, Today, null, 1, true, null).Value!;
        var listWholesale = PriceList.Create(Guid.CreateVersion7(), tenantId, "MAY", "Mayorista", null, "USD", false, Today, null, 2, false, null).Value!;

        var lists = new InMemoryPriceListRepository();
        lists.Seed(listPublic);
        lists.Seed(listWholesale);

        var prices = new InMemoryProductPriceRepository();
        var sameDayPrice = ProductPrice.Create(Guid.CreateVersion7(), tenantId, listPublic.Id, itemA.Id, 10m, Today, null, null).Value!;
        var olderPrice = ProductPrice.Create(Guid.CreateVersion7(), tenantId, listWholesale.Id, itemA.Id, 8m, Today.AddDays(-5), null, null).Value!;
        prices.Seed(sameDayPrice);
        prices.Seed(olderPrice);

        var history = new InMemoryPriceChangeLogRepository();
        var unitOfWork = new InMemoryUnitOfWork();
        var handler = CreateHandler(lists, prices, history, unitOfWork, Items(itemA, itemB));

        var result = await handler.Handle(
            new BulkUpsertMatrixPricesCommand(
                tenantId,
                Today,
                null,
                "Ajuste desde matriz",
                [
                    new MatrixPriceUpsertEntryInput(listPublic.Id, itemA.Id, 12.50m),
                    new MatrixPriceUpsertEntryInput(listWholesale.Id, itemA.Id, 9.00m),
                    new MatrixPriceUpsertEntryInput(listPublic.Id, itemB.Id, 20.00m),
                ]),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.UpdatedCount.Should().Be(1);
        result.Value.CreatedCount.Should().Be(2);
        sameDayPrice.Price.Should().Be(12.50m);
        olderPrice.ValidTo.Should().Be(Today.AddDays(-1));
        history.Entries.Should().HaveCount(3);
        unitOfWork.SaveCount.Should().Be(1);
    }

    [Fact(DisplayName = "Matrix bulk-upsert rechaza combinaciones duplicadas de lista y producto")]
    public async Task Handle_DuplicatePair_FailsValidation()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId, "Producto A", "SKU-A");
        var list = PriceList.Create(Guid.CreateVersion7(), tenantId, "PVP", "Público", null, "USD", true, Today, null, 1, true, null).Value!;
        var lists = new InMemoryPriceListRepository();
        lists.Seed(list);
        var handler = CreateHandler(lists, new InMemoryProductPriceRepository(), new InMemoryPriceChangeLogRepository(), new InMemoryUnitOfWork(), Items(item));

        var result = await handler.Handle(
            new BulkUpsertMatrixPricesCommand(
                tenantId,
                Today,
                null,
                null,
                [
                    new MatrixPriceUpsertEntryInput(list.Id, item.Id, 10m),
                    new MatrixPriceUpsertEntryInput(list.Id, item.Id, 12m),
                ]),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.matrix.validation");
    }

    private static BulkUpsertMatrixPricesHandler CreateHandler(
        InMemoryPriceListRepository lists,
        InMemoryProductPriceRepository prices,
        InMemoryPriceChangeLogRepository history,
        InMemoryUnitOfWork unitOfWork,
        ICatalogItemRepository items)
    {
        var idGen = Substitute.For<IIdGenerator>();
        idGen.NewId().Returns(_ => Guid.CreateVersion7());
        var caller = Substitute.For<ICallerContext>();
        caller.UserId.Returns(Guid.CreateVersion7());

        return new BulkUpsertMatrixPricesHandler(
            new BulkUpsertMatrixPricesValidator(),
            idGen,
            caller,
            lists,
            prices,
            history,
            items,
            unitOfWork);
    }

    private static CatalogItem Physical(Guid tenantId, string name, string sku) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            name,
            null,
            sku,
            null,
            null,
            "{}",
            null,
            null).Value!;

    private static ICatalogItemRepository Items(params CatalogItem[] seeded)
    {
        var repo = Substitute.For<ICatalogItemRepository>();
        repo.GetActiveByIdsAsync(Arg.Any<Guid>(), Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var ids = call.ArgAt<IReadOnlyCollection<Guid>>(1);
                return Task.FromResult<IReadOnlyList<CatalogItem>>(seeded.Where(i => ids.Contains(i.Id)).ToList());
            });
        return repo;
    }
}
