using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Catalog.ValueObjects;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class GetCatalogItemHandlerTests
{
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly ICategoryRepository _categories = Substitute.For<ICategoryRepository>();
    private readonly IProductTemplateRepository _templates = Substitute.For<IProductTemplateRepository>();

    [Fact(DisplayName = "La variante sin foto hereda la imagen principal del modelo")]
    public async Task Handle_VariantWithoutImage_InheritsModelImage()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Modelo",
            null,
            "MOD-01",
            5m,
            null,
            "[{\"name\":\"Caña\",\"values\":[\"Corta\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var imageResult = parent.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/p/1_large.webp",
            "foto.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/thumb.webp",
            "https://cdn/medium.webp",
            "https://cdn/large.webp",
            setAsMain: true);
        imageResult.IsSuccess.Should().BeTrue();

        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña corta",
            "MOD-01-0001",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(child).IsSuccess.Should().BeTrue();

        _items.GetActiveByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, parentId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var variant = result.Value!.Variants!.Single();
        variant.MainImageThumbUrl.Should().Be("https://cdn/thumb.webp");
        variant.ImageInherited.Should().BeTrue();
    }

    [Fact(DisplayName = "La variante con foto propia conserva su imagen y no se marca heredada")]
    public async Task Handle_VariantWithOwnImage_KeepsOwnImage()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Modelo",
            null,
            "MOD-02",
            5m,
            null,
            "[{\"name\":\"Caña\",\"values\":[\"Corta\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        parent.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/p/model_large.webp",
            "modelo.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/model-thumb.webp",
            "https://cdn/model-medium.webp",
            "https://cdn/model-large.webp",
            setAsMain: true);

        var child = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña corta",
            "MOD-02-0001",
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        child.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/c/own_large.webp",
            "propia.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/own-thumb.webp",
            "https://cdn/own-medium.webp",
            "https://cdn/own-large.webp",
            setAsMain: true);

        parent.AddVariantChild(child).IsSuccess.Should().BeTrue();

        _items.GetActiveByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, parentId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var variant = result.Value!.Variants!.Single();
        variant.MainImageThumbUrl.Should().Be("https://cdn/own-thumb.webp");
        variant.ImageInherited.Should().BeFalse();
    }

    [Fact(DisplayName = "La variante hereda la foto de su grupo y cae al modelo si no coincide")]
    public async Task Handle_VariantImageResolution_PrefersGroupThenModel()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín con Cañas",
            null,
            "MOD-03",
            5m,
            null,
            "[{\"name\":\"Caña\",\"values\":[\"Corta\",\"Larga\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        parent.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/p/group_large.webp",
            "corta.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/corta-thumb.webp",
            "https://cdn/corta-medium.webp",
            "https://cdn/corta-large.webp",
            setAsMain: false,
            groupValue: "Corta");

        parent.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/p/model_large.webp",
            "modelo.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/model-thumb.webp",
            "https://cdn/model-medium.webp",
            "https://cdn/model-large.webp",
            setAsMain: true);

        var corta = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña corta",
            "MOD-03-0001",
            null,
            """{"ca\u00F1a":"Corta"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(corta);

        var larga = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "Caña larga",
            "MOD-03-0002",
            null,
            """{"ca\u00F1a":"Larga"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(larga);

        _items.GetActiveByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, parentId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var variants = result.Value!.Variants!;
        variants.Single(v => v.Sku == "MOD-03-0001").MainImageThumbUrl.Should().Be("https://cdn/corta-thumb.webp");
        variants.Single(v => v.Sku == "MOD-03-0001").ImageInheritedFrom.Should().Be("group");
        variants.Single(v => v.Sku == "MOD-03-0002").MainImageThumbUrl.Should().Be("https://cdn/model-thumb.webp");
        variants.Single(v => v.Sku == "MOD-03-0002").ImageInheritedFrom.Should().Be("model");
    }
}
