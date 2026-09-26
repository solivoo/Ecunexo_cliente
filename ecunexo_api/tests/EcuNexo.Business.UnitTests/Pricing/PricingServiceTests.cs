using EcuNexo.Business.Catalog;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.UnitTests.Pricing.Support;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Pricing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Pricing;

public sealed class PricingServiceTests
{
    private static readonly DateOnly Today = new(2026, 9, 26);

    [Fact(DisplayName = "Precio público de lista suma el impuesto y registra reglas")]
    public async Task ResolveAsync_PublicPrice_ReturnsNetWithTax()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, item.Id, 100m));

        var result = await Service(lists, prices, item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 2m, Today), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var value = result.Value!;
        value.PriceListCode.Should().Be("PUBLICO");
        value.UnitPrice.Should().Be(100m);
        value.Subtotal.Should().Be(200m);
        value.TaxAmount.Should().Be(30m);
        value.FinalPrice.Should().Be(230m);
        value.AppliedRules.Should().Contain("LISTA_PUBLICO");
        value.TierPrice.Should().BeNull();
    }

    [Fact(DisplayName = "La lista explícita tiene prioridad sobre la predeterminada")]
    public async Task ResolveAsync_ExplicitList_UsesThatList()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var publicList = List(tenantId, "PUBLICO", isDefault: true);
        var wholesale = List(tenantId, "MAYORISTA", isDefault: false);
        lists.Seed(publicList);
        lists.Seed(wholesale);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, publicList.Id, item.Id, 100m));
        prices.Seed(Price(tenantId, wholesale.Id, item.Id, 90m));

        var result = await Service(lists, prices, item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today, wholesale.Id), CancellationToken.None);

        result.Value!.PriceListCode.Should().Be("MAYORISTA");
        result.Value.UnitPrice.Should().Be(90m);
    }

    [Fact(DisplayName = "Sin lista predeterminada la resolución falla")]
    public async Task ResolveAsync_WithoutDefaultList_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        lists.Seed(List(tenantId, "MAYORISTA", isDefault: false));

        var result = await Service(lists, new InMemoryProductPriceRepository(), item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.not_found");
    }

    [Fact(DisplayName = "Una lista inactiva no es válida para resolver")]
    public async Task ResolveAsync_InactiveList_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: false);
        list.SetActive(false);
        lists.Seed(list);

        var result = await Service(lists, new InMemoryProductPriceRepository(), item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today, list.Id), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price_list.not_valid");
    }

    [Fact(DisplayName = "Producto sin precio configurado es rechazado")]
    public async Task ResolveAsync_ProductWithoutPrice_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        lists.Seed(List(tenantId, "PUBLICO", isDefault: true));

        var result = await Service(lists, new InMemoryProductPriceRepository(), item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.price.not_found");
    }

    [Fact(DisplayName = "Un producto de otra empresa se comporta como inexistente")]
    public async Task ResolveAsync_OtherTenantItem_Fails()
    {
        var tenantA = Guid.CreateVersion7();
        var tenantB = Guid.CreateVersion7();
        var item = Physical(tenantA);

        var result = await Service(new InMemoryPriceListRepository(), new InMemoryProductPriceRepository(), item)
            .ResolveAsync(tenantB, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.item.not_found");
    }

    [Fact(DisplayName = "La variante hereda el precio vigente del padre matriz")]
    public async Task ResolveAsync_VariantInheritsParentPrice()
    {
        var tenantId = Guid.CreateVersion7();
        var parent = MatrixParent(tenantId);
        var variant = Variant(parent);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, parent.Id, 50m));

        var result = await Service(lists, prices, variant)
            .ResolveAsync(tenantId, new PricingRequest(variant.Id, 1m, Today), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.UnitPrice.Should().Be(50m);
        result.Value.AppliedRules.Should().Contain("PRECIO_HEREDADO_PADRE");
    }

    [Fact(DisplayName = "La escala por cantidad define el precio unitario")]
    public async Task ResolveAsync_WithTier_UsesTierPrice()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        var price = Price(tenantId, list.Id, item.Id, 100m);
        price.AddTier(Guid.CreateVersion7(), 6m, 20m, 95m);
        prices.Seed(price);

        var result = await Service(lists, prices, item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 10m, Today), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.UnitPrice.Should().Be(95m);
        result.Value.TierPrice.Should().Be(95m);
        result.Value.TierLabel.Should().Be("6 - 20");
        result.Value.Subtotal.Should().Be(950m);
        result.Value.FinalPrice.Should().Be(1092.5m);
    }

    [Fact(DisplayName = "La promoción vigente aplica descuento sobre el subtotal")]
    public async Task ResolveAsync_PercentagePromotion_AppliesDiscount()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, item.Id, 100m));
        var promotions = new InMemoryPromotionRepository();
        promotions.Seed(Promo(tenantId, "DIEZ", PromotionType.Percentage, 10m, item.Id));

        var result = await Service(lists, prices, item, promotions)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.DiscountAmount.Should().Be(10m);
        result.Value.NetPrice.Should().Be(90m);
        result.Value.TaxAmount.Should().Be(13.5m);
        result.Value.FinalPrice.Should().Be(103.5m);
        result.Value.AppliedRules.Should().Contain("PROMO_DIEZ");
    }

    [Fact(DisplayName = "Una promoción que no cubre el producto no aplica")]
    public async Task ResolveAsync_PromotionForOtherItem_IsIgnored()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var other = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, item.Id, 100m));
        var promotions = new InMemoryPromotionRepository();
        promotions.Seed(Promo(tenantId, "OTRO", PromotionType.Percentage, 50m, other.Id));

        var result = await Service(lists, prices, item, promotions)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.Value!.DiscountAmount.Should().Be(0m);
        result.Value.AppliedRules.Should().NotContain("PROMO_OTRO");
    }

    [Fact(DisplayName = "Precio con impuesto incluido desagrega base y valor")]
    public async Task ResolveAsync_TaxIncluded_ExtractsBase()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);
        var lists = new InMemoryPriceListRepository();
        var list = List(tenantId, "PUBLICO", isDefault: true, includeTax: true);
        lists.Seed(list);
        var prices = new InMemoryProductPriceRepository();
        prices.Seed(Price(tenantId, list.Id, item.Id, 115m));

        var result = await Service(lists, prices, item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 1m, Today), CancellationToken.None);

        result.Value!.NetPrice.Should().Be(115m);
        result.Value.TaxableBase.Should().Be(100m);
        result.Value.TaxAmount.Should().Be(15m);
        result.Value.FinalPrice.Should().Be(115m);
    }

    [Fact(DisplayName = "Cantidad no positiva es rechazada")]
    public async Task ResolveAsync_InvalidQuantity_Fails()
    {
        var tenantId = Guid.CreateVersion7();
        var item = Physical(tenantId);

        var result = await Service(new InMemoryPriceListRepository(), new InMemoryProductPriceRepository(), item)
            .ResolveAsync(tenantId, new PricingRequest(item.Id, 0m, Today), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.pricing.quantity.range");
    }

    private static PricingService Service(
        InMemoryPriceListRepository lists,
        InMemoryProductPriceRepository prices,
        CatalogItem item,
        InMemoryPromotionRepository? promotions = null)
    {
        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdAsync(item.TenantId, item.Id, Arg.Any<CancellationToken>()).Returns(item);
        return new PricingService(
            lists,
            prices,
            promotions ?? new InMemoryPromotionRepository(),
            items,
            new EcuadorTaxRateProvider());
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

    private static CatalogItem MatrixParent(Guid tenantId) =>
        CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Camiseta",
            description: null,
            modelCode: $"CAM-{Guid.NewGuid():N}"[..10],
            basePrice: null,
            categoryId: null,
            variantDimensionsJson: "[{\"name\":\"Talla\",\"values\":[\"S\",\"M\"]}]",
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

    private static CatalogItem Variant(CatalogItem parent) =>
        CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Talla S",
            $"VAR-{Guid.NewGuid():N}"[..10],
            basePrice: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

    private static PriceList List(
        Guid tenantId,
        string code,
        bool isDefault,
        bool includeTax = false) =>
        PriceList.Create(
            Guid.CreateVersion7(),
            tenantId,
            code,
            $"Lista {code}",
            null,
            null,
            includeTax,
            Today,
            null,
            priority: 0,
            isDefault: isDefault).Value!;

    private static ProductPrice Price(Guid tenantId, Guid priceListId, Guid itemId, decimal price) =>
        ProductPrice.Create(
            Guid.CreateVersion7(),
            tenantId,
            priceListId,
            itemId,
            price,
            Today,
            null).Value!;

    private static Promotion Promo(
        Guid tenantId,
        string code,
        PromotionType type,
        decimal value,
        Guid targetItemId)
    {
        var promotion = Promotion.Create(
            Guid.CreateVersion7(),
            tenantId,
            code,
            $"Promo {code}",
            null,
            type,
            value,
            new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            new DateTimeOffset(2026, 12, 31, 0, 0, 0, TimeSpan.Zero),
            priority: 1,
            isStackable: false).Value!;

        promotion.AddTarget(Guid.CreateVersion7(), PromotionTargetType.Product, targetItemId.ToString());
        return promotion;
    }
}
