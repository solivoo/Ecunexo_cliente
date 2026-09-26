using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;
using EcuNexo.Business.Tenancy;
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

    [Fact(DisplayName = "Lista productos activos con imagen y paginación")]
    public async Task Handle_ListsProductsWithStock()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!;
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

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

        _products
            .ListActiveRootsAsync(tenantId, Arg.Any<StorefrontProductFilter>(), Arg.Any<CancellationToken>())
            .Returns((new List<CatalogItem> { item }, 1));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [itemId] = 4m });

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(
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
        dto.Price.Should().Be(3.5m);
        dto.InStock.Should().BeTrue();
        dto.HasVariants.Should().BeFalse();

        await _products.Received(1).ListActiveRootsAsync(
            tenantId,
            Arg.Is<StorefrontProductFilter>(f =>
                f.Page == 1
                && f.PageSize == 24),
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "La disponibilidad de la matriz suma padre y variantes")]
    public async Task Handle_MatrixAvailability_SumsVariants()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

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

        _products
            .ListActiveRootsAsync(tenantId, Arg.Any<StorefrontProductFilter>(), Arg.Any<CancellationToken>())
            .Returns((new List<CatalogItem> { parent }, 1));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [parentId] = 0m, [variant.Id] = 6m });

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

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
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

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

        _products
            .ListActiveRootsAsync(tenantId, Arg.Any<StorefrontProductFilter>(), Arg.Any<CancellationToken>())
            .Returns((new List<CatalogItem> { item }, 1));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Single().ThumbUrl.Should().Be("https://cdn/model-thumb.webp");
    }

    [Fact(DisplayName = "Tenant inexistente no expone la tienda")]
    public async Task Handle_UnknownTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns((Tenant?)null);

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        result.Error.Type.Should().Be(ErrorType.NotFound);
        await _products.DidNotReceiveWithAnyArgs().ListActiveRootsAsync(default, default!, default);
    }

    [Fact(DisplayName = "Tenant cancelado no expone la tienda")]
    public async Task Handle_CancelledTenant_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var tenant = Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!;
        tenant.Cancel();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

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

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.tenant.not_found");
        await _products.DidNotReceiveWithAnyArgs().ListActiveRootsAsync(default, default!, default);
    }

    [Fact(DisplayName = "Tenant con ecommerce habilitado publica la tienda")]
    public async Task Handle_TenantWithEcommerceEntitlement_AllowsStorefront()
    {
        var tenantId = Guid.CreateVersion7();
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
        _products
            .ListActiveRootsAsync(tenantId, Arg.Any<StorefrontProductFilter>(), Arg.Any<CancellationToken>())
            .Returns((new List<CatalogItem>(), 0));

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().BeEmpty();
    }

    [Fact(DisplayName = "El precio del listado sale de la lista predeterminada de precios")]
    public async Task Handle_WithDefaultPriceList_UsesResolvedPrice()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var itemId = Guid.CreateVersion7();
        var item = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            null,
            "CALC-01",
            3.5m,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _products
            .ListActiveRootsAsync(tenantId, Arg.Any<StorefrontProductFilter>(), Arg.Any<CancellationToken>())
            .Returns((new List<CatalogItem> { item }, 1));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());

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
            .Returns(new Dictionary<Guid, decimal> { [itemId] = 7.25m });

        var sut = new ListStorefrontProductsHandler(_products, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new ListStorefrontProductsQuery(tenantId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Single().Price.Should().Be(7.25m);
    }
}
