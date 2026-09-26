using EcuNexo.Business.Catalog;
using EcuNexo.Business.Pricing.Queries.GetProductPrice;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class GetProductPriceHandlerTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "El detalle de precio incluye producto, lista y escalas")]
    public async Task Handle_ExistingPrice_ReturnsDetail()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = PriceList.Create(
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
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        var price = ProductPrice.Create(
            Guid.CreateVersion7(),
            tenantId,
            list.Id,
            item.Id,
            100m,
            Today,
            null).Value!;
        price.AddTier(Guid.CreateVersion7(), 6m, 20m, 95m);
        prices.Seed(price);

        var handler = new GetProductPriceHandler(prices, lists, ItemRepository(item));
        var result = await handler.Handle(
            new GetProductPriceQuery(tenantId, price.Id),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.ItemName.Should().Be("Aceite 10W40");
        result.Value.PriceListCode.Should().Be("PUBLICO");
        result.Value.Tiers.Should().ContainSingle();
        result.Value.Tiers[0].UnitPrice.Should().Be(95m);
    }

    [Fact(DisplayName = "Un precio inexistente responde not found")]
    public async Task Handle_UnknownPrice_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var handler = new GetProductPriceHandler(
            new InMemoryProductPriceRepository(),
            new InMemoryPriceListRepository(),
            Substitute.For<ICatalogItemRepository>());

        var result = await handler.Handle(
            new GetProductPriceQuery(tenantId, Guid.CreateVersion7()),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.product_price.not_found");
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
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;
}
