using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Storefront;

public sealed class GetStorefrontProductHandlerTests
{
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly IStockRepository _stock = Substitute.For<IStockRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IPriceListRepository _priceLists = Substitute.For<IPriceListRepository>();
    private readonly IProductPriceRepository _productPrices = Substitute.For<IProductPriceRepository>();

    [Fact(DisplayName = "El detalle sanitiza la ficha, parsea atributos y expone disponibilidad por variante")]
    public async Task Handle_ReturnsSanitizedDetail()
    {
        var tenantId = Guid.CreateVersion7();
        var productId = Guid.CreateVersion7();
        var variantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var image = CreateImage(productId, "https://cdn/thumb.webp", "https://cdn/medium.webp", "https://cdn/large.webp");
        var variant = new CatalogItemVariantDto(
            variantId,
            "39-41 / #000000",
            "CALC-01-0001",
            3.5m,
            "{\"internal\":\"no exponer\"}",
            CatalogItemStatus.Active,
            MainImageThumbUrl: "https://cdn/thumb.webp",
            ImageInherited: true,
            ImageInheritedFrom: "model",
            DimensionValues: new Dictionary<string, string> { ["Tallas"] = "39-41" },
            Images: new List<CatalogItemImageResponse> { image },
            ExtraColors: new List<string> { "#ec4899" });

        var matrix = new CatalogMatrixDescriptorDto(
            1,
            new List<CatalogMatrixAxisDto>
            {
                new("Tallas", "size", new List<string> { "39-41" }, false),
            },
            "Tallas",
            new List<string>());

        var detail = new CatalogItemDetailResponse(
            productId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            "Algodón",
            null,
            3.5m,
            "{}",
            CatalogItemStatus.Active,
            DateTimeOffset.UtcNow,
            null,
            new List<CatalogItemImageResponse> { image },
            true,
            null,
            "[{\"name\":\"Tallas\",\"values\":[\"39-41\"]}]",
            new List<CatalogItemVariantDto> { variant },
            null,
            null,
            null,
            "[{\"level\":\"Modelo\",\"name\":\"Marca\",\"value\":\"Nike\"}]",
            matrix);

        _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                Arg.Any<GetCatalogItemQuery>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(detail));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal> { [productId] = 0m, [variantId] = 3m });

        var sut = new GetStorefrontProductHandler(_sender, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new GetStorefrontProductQuery(tenantId, productId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.Name.Should().Be("Calcetín Runner");
        dto.InStock.Should().BeTrue();
        dto.AvailableQuantity.Should().Be(3m);
        dto.Images.Should().ContainSingle();
        dto.Matrix.Should().NotBeNull();
        dto.Matrix!.PrimaryAxis.Should().Be("Tallas");
        dto.Attributes.Should().ContainSingle();
        dto.Attributes[0].Should().Be(new StorefrontAttributeDto("Modelo", "Marca", "Nike"));

        var variantDto = dto.Variants.Single();
        variantDto.InStock.Should().BeTrue();
        variantDto.AvailableQuantity.Should().Be(3m);
        variantDto.Dimensions!["Tallas"].Should().Be("39-41");
        variantDto.MainImageMediumUrl.Should().Be("https://cdn/medium.webp");
        variantDto.ImageInheritedFrom.Should().Be("model");
        variantDto.ExtraColors.Should().Equal("#ec4899");
    }

    [Fact(DisplayName = "Producto inexistente responde no disponible")]
    public async Task Handle_UnknownProduct_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);
        _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                Arg.Any<GetCatalogItemQuery>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Failure<CatalogItemDetailResponse>(
                new Error("catalog.item.not_found", "No existe.", ErrorType.NotFound)));

        var sut = new GetStorefrontProductHandler(_sender, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(
            new GetStorefrontProductQuery(tenantId, Guid.CreateVersion7()),
            CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.product.not_found");
    }

    [Fact(DisplayName = "Un producto inactivo no se expone en la tienda")]
    public async Task Handle_InactiveProduct_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var productId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var detail = new CatalogItemDetailResponse(
            productId,
            CatalogItemKind.Physical,
            "Producto oculto",
            null,
            "SKU-1",
            1m,
            "{}",
            CatalogItemStatus.Inactive,
            DateTimeOffset.UtcNow,
            null,
            new List<CatalogItemImageResponse>());

        _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                Arg.Any<GetCatalogItemQuery>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(detail));

        var sut = new GetStorefrontProductHandler(_sender, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new GetStorefrontProductQuery(tenantId, productId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.product.not_found");
        await _stock.DidNotReceiveWithAnyArgs().SumAvailableByItemIdsAsync(default, default!, default);
    }

    [Fact(DisplayName = "Un servicio no se expone en la tienda")]
    public async Task Handle_Service_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var productId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var detail = new CatalogItemDetailResponse(
            productId,
            CatalogItemKind.Service,
            "Asesoría contable",
            null,
            null,
            80m,
            "{}",
            CatalogItemStatus.Active,
            DateTimeOffset.UtcNow,
            null,
            new List<CatalogItemImageResponse>());

        _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                Arg.Any<GetCatalogItemQuery>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(detail));

        var sut = new GetStorefrontProductHandler(_sender, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new GetStorefrontProductQuery(tenantId, productId), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("storefront.product.not_found");
        await _stock.DidNotReceiveWithAnyArgs().SumAvailableByItemIdsAsync(default, default!, default);
    }

    [Fact(DisplayName = "Un producto simple expone su SKU y atributos JSONB de ficha")]
    public async Task Handle_SimpleProduct_ExposesSkuAndCustomAttributes()
    {
        var tenantId = Guid.CreateVersion7();
        var productId = Guid.CreateVersion7();
        _tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Tenant.Create(tenantId, "Tienda Demo", new ServicePlan("Small", 3, 1)).Value!);

        var detail = new CatalogItemDetailResponse(
            productId,
            CatalogItemKind.Physical,
            "Nike colores",
            "Nike de colores",
            "NIK002",
            5m,
            "{\"color\":[\"#EAB308\"],\"marca\":\"Nike\",\"talla\":\"10-12\",\"material\":\"Algodón\",\"parent_reassignment_history\":[{\"x\":1}],\"tags\":[\"oferta\"]}",
            CatalogItemStatus.Active,
            DateTimeOffset.UtcNow,
            null,
            new List<CatalogItemImageResponse>());

        _sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                Arg.Any<GetCatalogItemQuery>(),
                Arg.Any<CancellationToken>())
            .Returns(Result.Success(detail));
        _stock
            .SumAvailableByItemIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, decimal>());

        var sut = new GetStorefrontProductHandler(_sender, _stock, _tenants, _priceLists, _productPrices);
        var result = await sut.Handle(new GetStorefrontProductQuery(tenantId, productId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var dto = result.Value!;
        dto.Sku.Should().Be("NIK002");
        dto.Variants.Should().BeEmpty();

        dto.Attributes.Select(a => (a.Name, a.Value)).Should().Contain(new[]
        {
            ("Marca", "Nike"),
            ("Talla", "10-12"),
            ("Material", "Algodón"),
            ("Color", "#EAB308"),
        });
        dto.Attributes.Select(a => a.Name).Should().NotContain("Tags");
        dto.Attributes.Select(a => a.Name).Should().NotContain("Parent_reassignment_history");
    }

    private static CatalogItemImageResponse CreateImage(
        Guid productId,
        string thumbUrl,
        string mediumUrl,
        string largeUrl) =>
        new(
            Guid.CreateVersion7(),
            productId,
            "foto.webp",
            "Calcetín",
            1,
            true,
            1200,
            1200,
            1024,
            "image/webp",
            thumbUrl,
            mediumUrl,
            largeUrl,
            DateTimeOffset.UtcNow);
}
