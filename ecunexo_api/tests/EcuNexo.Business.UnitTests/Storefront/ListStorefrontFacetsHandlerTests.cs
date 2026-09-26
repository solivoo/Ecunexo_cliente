using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.ListStorefrontFacets;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class ListStorefrontFacetsHandlerTests
{
    private readonly IStorefrontCatalogRepository _products = Substitute.For<IStorefrontCatalogRepository>();
    private readonly IStockRepository _stock = Substitute.For<IStockRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IPriceListRepository _priceLists = Substitute.For<IPriceListRepository>();
    private readonly IProductPriceRepository _productPrices = Substitute.For<IProductPriceRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly ListStorefrontFacetsHandler _sut;

    public ListStorefrontFacetsHandlerTests()
    {
        _products
            .ListActiveRootsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(new List<CatalogItem>());
        _stock
            .SumAvailableByItemIdsAsync(
                Arg.Any<Guid>(),
                Arg.Any<Guid?>(),
                Arg.Any<IReadOnlyCollection<Guid>>(),
                Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());

        _sut = new ListStorefrontFacetsHandler(
            _tenants,
            new StorefrontCatalogReader(_products, _stock, _priceLists, _productPrices, _warehouses));
    }

    [Fact(DisplayName = "Construye facetas canónicas con counts y orden de valores")]
    public async Task Handle_BuildsCanonicalFacetsWithCounts()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var red = CreateItem(tenantId, customAttributesJson: """{ "Tallas": "M", "Marca": "Nike", "color": "Rojo" }""");
        var adidas = CreateItem(tenantId, customAttributesJson: """{ "Talla": "M", "marca": "Adidas" }""");
        var redVariant = CreateItem(tenantId, customAttributesJson: """{ "color": "rojo" }""");
        SetupProducts(red, adidas, redVariant);

        var result = await _sut.Handle(new ListStorefrontFacetsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var facets = result.Value!;
        facets.Attributes.Select(a => a.Key).Should().Equal("talla", "color", "marca");

        var talla = facets.Attributes[0];
        talla.Label.Should().Be("Talla");
        talla.Values.Should().ContainSingle().Which.Should().Be(new StorefrontFacetValueDto("M", "M", 2));

        var color = facets.Attributes[1];
        color.Values.Should().ContainSingle();
        color.Values[0].Value.Should().Be("Rojo");
        color.Values[0].Count.Should().Be(2);

        var marca = facets.Attributes[2];
        marca.Values.Select(v => v.Label).Should().Equal("Adidas", "Nike");
        marca.Values.Should().OnlyContain(v => v.Count == 1);
    }

    [Fact(DisplayName = "Calcula rango de precios, stock y novedades")]
    public async Task Handle_ComputesPriceRangeStockAndNewCount()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var recent = CreateItem(tenantId, basePrice: 3.5m);
        var old = CreateItem(tenantId, basePrice: 12m);
        SetCreatedAt(old, DateTimeOffset.UtcNow.AddDays(-40));
        SetupProducts(recent, old);
        SetupStock((recent.Id, 4m));

        var result = await _sut.Handle(new ListStorefrontFacetsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var facets = result.Value!;
        facets.PriceMin.Should().Be(3.5m);
        facets.PriceMax.Should().Be(12m);
        facets.InStockCount.Should().Be(1);
        facets.NewCount.Should().Be(1);
    }

    [Fact(DisplayName = "Sin productos devuelve facetas vacías y precios nulos")]
    public async Task Handle_WithoutProducts_ReturnsEmptyFacets()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var result = await _sut.Handle(new ListStorefrontFacetsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var facets = result.Value!;
        facets.Attributes.Should().BeEmpty();
        facets.PriceMin.Should().BeNull();
        facets.PriceMax.Should().BeNull();
        facets.InStockCount.Should().Be(0);
        facets.NewCount.Should().Be(0);
    }

    [Fact(DisplayName = "Tenant inexistente no expone facetas")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var result = await _sut.Handle(new ListStorefrontFacetsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _products.DidNotReceiveWithAnyArgs().ListActiveRootsAsync(default, default);
    }

    private void SetupTenant(Guid tenantId)
    {
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
    }

    private void SetupProducts(params CatalogItem[] items)
    {
        _products
            .ListActiveRootsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(items.ToList());
    }

    private void SetupStock(params (Guid ItemId, decimal Available)[] entries)
    {
        _stock
            .SumAvailableByItemIdsAsync(
                Arg.Any<Guid>(),
                Arg.Any<Guid?>(),
                Arg.Any<IReadOnlyCollection<Guid>>(),
                Arg.Any<CancellationToken>())
            .Returns(entries.ToDictionary(entry => entry.ItemId, entry => entry.Available));
    }

    private static CatalogItem CreateItem(
        Guid tenantId,
        decimal basePrice = 3.5m,
        string? customAttributesJson = null) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            null,
            $"CALC-{Guid.NewGuid().ToString("N")[..10]}",
            basePrice,
            customAttributesJson,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

    private static void SetCreatedAt(CatalogItem item, DateTimeOffset createdAt) =>
        typeof(CatalogItem)
            .GetProperty(nameof(CatalogItem.CreatedAt))!
            .SetValue(item, createdAt);
}
