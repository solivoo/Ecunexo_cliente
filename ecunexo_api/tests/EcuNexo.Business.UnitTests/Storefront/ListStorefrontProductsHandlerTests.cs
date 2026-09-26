using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Catalog.ValueObjects;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class ListStorefrontProductsHandlerTests
{
    private readonly IStorefrontCatalogRepository _products = Substitute.For<IStorefrontCatalogRepository>();
    private readonly IStockRepository _stock = Substitute.For<IStockRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IPriceListRepository _priceLists = Substitute.For<IPriceListRepository>();
    private readonly IProductPriceRepository _productPrices = Substitute.For<IProductPriceRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly ListStorefrontProductsHandler _sut;

    public ListStorefrontProductsHandlerTests()
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

        _sut = new ListStorefrontProductsHandler(
            _tenants,
            new StorefrontCatalogReader(_products, _stock, _priceLists, _productPrices, _warehouses));
    }

    [Fact(DisplayName = "Lista productos activos con imagen y paginación")]
    public async Task Handle_ListsProductsWithStock()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var itemId = Guid.CreateVersion7();
        var item = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            "Algodón",
            "CALC-01",
            3.5m,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        item.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/i/large.webp",
            "calcetin.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            1024,
            "https://cdn/thumb.webp",
            "https://cdn/medium.webp",
            "https://cdn/large.webp",
            setAsMain: true);

        SetupProducts(item);
        SetupStock((itemId, 4m));

        var result = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId),
            CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var page = result.Value!;
        page.TotalCount.Should().Be(1);
        page.Items.Should().ContainSingle();

        var dto = page.Items[0];
        dto.Name.Should().Be("Calcetín Runner");
        dto.ThumbUrl.Should().Be("https://cdn/thumb.webp");
        dto.MediumUrl.Should().Be("https://cdn/medium.webp");
        dto.SecondMediumUrl.Should().BeNull();
        dto.Colors.Should().BeEmpty();
        dto.IsNew.Should().BeTrue();
        dto.Price.Should().Be(3.5m);
        dto.InStock.Should().BeTrue();
        dto.HasVariants.Should().BeFalse();

        await _products.Received(1).ListActiveRootsAsync(tenantId, Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "La disponibilidad de la matriz suma padre y variantes")]
    public async Task Handle_MatrixAvailability_SumsVariants()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var parentId = Guid.CreateVersion7();
        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Deportivo",
            null,
            "MOD-01",
            5m,
            "[{\"name\":\"Tallas\",\"values\":[\"39-41\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        var variant = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "39-41",
            "MOD-01-0001",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(variant);

        SetupProducts(parent);
        SetupStock((parentId, 0m), (variant.Id, 6m));

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!.Items.Single();
        dto.InStock.Should().BeTrue();
        dto.HasVariants.Should().BeTrue();
        dto.VariantCount.Should().Be(1);
    }

    [Fact(DisplayName = "La imagen principal del listado prioriza la foto del modelo")]
    public async Task Handle_MainImage_PrefersModelImage()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var itemId = Guid.CreateVersion7();
        var item = CatalogItem.CreateMatrixParent(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Camisa Oxford",
            null,
            "CAM-01",
            20m,
            "[{\"name\":\"Color\",\"values\":[\"#ffffff\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        item.AddImage(
            Guid.CreateVersion7(),
            "group",
            "blanco.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            1024,
            "https://cdn/group-thumb.webp",
            "https://cdn/group-medium.webp",
            "https://cdn/group-large.webp",
            setAsMain: true,
            groupValue: "#ffffff");
        item.AddImage(
            Guid.CreateVersion7(),
            "model",
            "modelo.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            1024,
            "https://cdn/model-thumb.webp",
            "https://cdn/model-medium.webp",
            "https://cdn/model-large.webp",
            setAsMain: false);

        SetupProducts(item);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Single().ThumbUrl.Should().Be("https://cdn/model-thumb.webp");
    }

    [Fact(DisplayName = "Expone segunda imagen, colores y novedad")]
    public async Task Handle_MapsSecondImageColorsAndNewFlag()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var item = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Camisa Oxford",
            null,
            "CAM-02",
            20m,
            """{ "color": ["Rojo", "Azul"] }""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        item.AddImage(
            Guid.CreateVersion7(),
            "first",
            "primera.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            1024,
            "https://cdn/first-thumb.webp",
            "https://cdn/first-medium.webp",
            "https://cdn/first-large.webp",
            setAsMain: true);
        item.AddImage(
            Guid.CreateVersion7(),
            "second",
            "segunda.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            1024,
            "https://cdn/second-thumb.webp",
            "https://cdn/second-medium.webp",
            "https://cdn/second-large.webp",
            setAsMain: false);

        SetupProducts(item);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!.Items.Single();
        dto.SecondMediumUrl.Should().Be("https://cdn/second-medium.webp");
        dto.Colors.Should().Equal("Rojo", "Azul");
        dto.IsNew.Should().BeTrue();
    }

    [Fact(DisplayName = "Filtra por facetas: OR dentro de la faceta y AND entre facetas")]
    public async Task Handle_FiltersByFacets()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var nikeM = CreateItem(tenantId, "Calcetín Nike M", attrs: """{ "talla": "M", "marca": "Nike" }""");
        var nikeL = CreateItem(tenantId, "Calcetín Nike L", attrs: """{ "talla": "L", "marca": "Nike" }""");
        var adidasM = CreateItem(tenantId, "Calcetín Adidas M", attrs: """{ "Tallas": "M", "Marca": "Adidas" }""");
        SetupProducts(nikeM, nikeL, adidasM);

        var anySize = await _sut.Handle(
            new ListStorefrontProductsQuery(
                tenantId,
                Facets: new Dictionary<string, IReadOnlyList<string>> { ["talla"] = ["m", "L"] }),
            CancellationToken.None);

        anySize.Value!.TotalCount.Should().Be(3);

        var nikeOnly = await _sut.Handle(
            new ListStorefrontProductsQuery(
                tenantId,
                Facets: new Dictionary<string, IReadOnlyList<string>>
                {
                    ["talla"] = ["M"],
                    ["marca"] = ["nike"],
                }),
            CancellationToken.None);

        nikeOnly.Value!.Items.Select(i => i.Name).Should().Equal("Calcetín Nike M");
    }

    [Fact(DisplayName = "Filtra por rango de precio")]
    public async Task Handle_FiltersByPriceRange()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var cheap = CreateItem(tenantId, "Calcetín Barato", price: 3.5m);
        var expensive = CreateItem(tenantId, "Calcetín Premium", price: 12m);
        SetupProducts(cheap, expensive);

        var result = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId, PriceMin: 5m, PriceMax: 20m),
            CancellationToken.None);

        result.Value!.Items.Single().Name.Should().Be("Calcetín Premium");
    }

    [Fact(DisplayName = "Filtra por disponibilidad y productos nuevos")]
    public async Task Handle_FiltersByStockAndNew()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var available = CreateItem(tenantId, "Disponible");
        var soldOut = CreateItem(tenantId, "Agotado");
        var old = CreateItem(tenantId, "Antiguo");
        SetCreatedAt(old, DateTimeOffset.UtcNow.AddDays(-40));
        SetupProducts(available, soldOut, old);
        SetupStock((available.Id, 5m));

        var inStock = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId, InStock: true),
            CancellationToken.None);

        inStock.Value!.Items.Select(i => i.Name).Should().Equal("Disponible");

        var recent = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId, New: true),
            CancellationToken.None);

        recent.Value!.Items.Select(i => i.Name).Should().BeEquivalentTo(["Disponible", "Agotado"]);
    }

    [Fact(DisplayName = "Busca por nombre, sku y descripción sin distinguir acentos")]
    public async Task Handle_SearchesInMemory()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var item = CreateItem(tenantId, "Calcetín Runner", description: "Algodón premium");
        SetupProducts(item);

        var byDescription = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId, Search: "ALGODON"),
            CancellationToken.None);

        byDescription.Value!.Items.Should().ContainSingle();

        var noMatch = await _sut.Handle(
            new ListStorefrontProductsQuery(tenantId, Search: "inexistente"),
            CancellationToken.None);

        noMatch.Value!.Items.Should().BeEmpty();
    }

    [Fact(DisplayName = "El orden relevance prioriza disponibles y luego recientes")]
    public async Task Handle_DefaultSort_PrioritizesStockThenRecency()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var olderInStock = CreateItem(tenantId, "Disponible Antiguo");
        SetCreatedAt(olderInStock, DateTimeOffset.UtcNow.AddDays(-10));
        var newerSoldOut = CreateItem(tenantId, "Agotado Nuevo");
        SetupProducts(newerSoldOut, olderInStock);
        SetupStock((olderInStock.Id, 3m));

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.Value!.Items.Select(i => i.Name).Should().Equal("Disponible Antiguo", "Agotado Nuevo");
    }

    [Fact(DisplayName = "Tenant inexistente no expone la tienda")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        result.Error.Type.Should().Be(ErrorType.NotFound);
        await _products.DidNotReceiveWithAnyArgs().ListActiveRootsAsync(default, default);
    }

    [Fact(DisplayName = "Tenant cancelado no expone la tienda")]
    public async Task Handle_CancelledTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!;
        tenant.Cancel();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
    }

    [Fact(DisplayName = "Tenant sin módulo ecommerce habilitado no expone la tienda")]
    public async Task Handle_TenantWithoutEcommerceEntitlement_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Inventory, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Warehousing, ModuleTier.Small),
            }).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _products.DidNotReceiveWithAnyArgs().ListActiveRootsAsync(default, default);
    }

    [Fact(DisplayName = "Tenant con ecommerce habilitado publica la tienda")]
    public async Task Handle_TenantWithEcommerceEntitlement_AllowsStorefront()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenantWithEcommerce(tenantId);

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
    }

    [Fact(DisplayName = "El precio del listado sale de la lista predeterminada de precios")]
    public async Task Handle_WithDefaultPriceList_UsesResolvedPrice()
    {
        var tenantId = Guid.CreateVersion7();
        SetupTenant(tenantId);

        var item = CreateItem(tenantId, "Calcetín Runner", price: 3.5m);
        SetupProducts(item);

        var list = PriceList.Create(
            Guid.CreateVersion7(),
            tenantId,
            "PUBLICO",
            "Precio público",
            null,
            null,
            pricesIncludeTax: false,
            DateOnly.FromDateTime(DateTime.UtcNow),
            null,
            priority: 0,
            isDefault: true).Value!;
        _priceLists.GetDefaultAsync(tenantId, Arg.Any<CancellationToken>()).Returns(list);
        _productPrices
            .ListVigentByItemIdsAsync(
                tenantId,
                list.Id,
                Arg.Any<IReadOnlyCollection<Guid>>(),
                Arg.Any<DateOnly>(),
                Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [item.Id] = 7.25m });

        var result = await _sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Single().Price.Should().Be(7.25m);
    }

    private void SetupTenant(Guid tenantId)
    {
        _tenants
            .GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
    }

    private void SetupTenantWithEcommerce(Guid tenantId)
    {
        var tenant = Tenant.Create(
            tenantId,
            "Tienda Demo",
            new ServicePlan("Small", 3, 1),
            moduleEntitlements: new List<ModuleEntitlement>
            {
                ModuleEntitlement.FromTier(TenantModuleCodes.Ecommerce, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Inventory, ModuleTier.Small),
                ModuleEntitlement.FromTier(TenantModuleCodes.Warehousing, ModuleTier.Small),
            }).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);
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
        string name,
        decimal price = 3.5m,
        string? attrs = null,
        string? description = null) =>
        CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            name,
            description,
            $"CALC-{Guid.NewGuid().ToString("N")[..10]}",
            price,
            attrs,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

    private static void SetCreatedAt(CatalogItem item, DateTimeOffset createdAt) =>
        typeof(CatalogItem)
            .GetProperty(nameof(CatalogItem.CreatedAt))!
            .SetValue(item, createdAt);
}
