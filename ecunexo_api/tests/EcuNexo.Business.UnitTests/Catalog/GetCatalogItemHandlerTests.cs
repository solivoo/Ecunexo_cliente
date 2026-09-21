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

    [Fact(DisplayName = "El detalle expone descriptor de matriz y valores de dimensión por variante")]
    public async Task Handle_MatrixItem_ExposesDescriptorAndVariantDimensionValues()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Deportivo",
            null,
            "MOD-04",
            5m,
            null,
            "[{\"name\":\"Tallas\",\"values\":[\"39-41\",\"42-44\"]},{\"name\":\"Color\",\"values\":[\"#457fc9\",\"#ec4899\"]},{\"name\":\"Tipo de Caña\",\"values\":[\"Caña Alta\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        parent.AddImage(
            Guid.CreateVersion7(),
            "tenants/t/catalog/items/p/azul_large.webp",
            "azul.webp",
            null,
            ImageDimensions.Create(1200, 1200).Value!,
            12345,
            "https://cdn/azul-thumb.webp",
            "https://cdn/azul-medium.webp",
            "https://cdn/azul-large.webp",
            setAsMain: false,
            groupValue: "#457fc9");

        var variant = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "39-41 / #457fc9",
            "MOD-04-0001",
            null,
            """{"tallas":"39-41","color":"#457fc9","tags":["nike"]}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(variant);

        _items.GetActiveByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, parentId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var descriptor = result.Value!.MatrixDescriptor;
        descriptor.Should().NotBeNull();
        descriptor!.Depth.Should().Be(3);
        descriptor.PrimaryAxis.Should().Be("Tallas");
        descriptor.GroupValues.Should().Equal("#457fc9");
        descriptor.Axes.Select(a => (a.Name, a.Type)).Should().Equal(
            ("Tallas", "size"),
            ("Color", "color"),
            ("Tipo de Caña", "custom"));
        descriptor.Axes.Single(a => a.Name == "Color").IsPhotoGroup.Should().BeTrue();
        descriptor.Axes.Single(a => a.Name == "Tallas").IsPhotoGroup.Should().BeFalse();

        var dimensionValues = result.Value.Variants!.Single().DimensionValues;
        dimensionValues.Should().NotBeNull();
        dimensionValues!["Tallas"].Should().Be("39-41");
        dimensionValues["Color"].Should().Be("#457fc9");
        dimensionValues.ContainsKey("tags").Should().BeFalse();
    }

    [Fact(DisplayName = "El ítem sin dimensiones no expone descriptor de matriz")]
    public async Task Handle_ItemWithoutDimensions_DoesNotExposeDescriptor()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();

        var item = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín simple",
            null,
            "SIMPLE-01",
            3m,
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetActiveByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>())
            .Returns(item);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, itemId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.MatrixDescriptor.Should().BeNull();
    }

    [Fact(DisplayName = "La variante hereda la galería del grupo compuesto y expone tags y colores extra")]
    public async Task Handle_CompositePhotoGroup_InheritsGalleryAndMetadata()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Compuesto",
            null,
            "MOD-05",
            5m,
            null,
            "[{\"name\":\"Tallas\",\"values\":[\"39-41\"]},{\"name\":\"Tipo de Ca\u00F1a\",\"values\":[\"Alta\"],\"photoGroup\":true},{\"name\":\"Color\",\"values\":[\"#457fc9\"],\"photoGroup\":true}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        foreach (var fileName in new[] { "azul-alta.webp", "azul-alta-2.webp" })
        {
            parent.AddImage(
                Guid.CreateVersion7(),
                $"tenants/t/catalog/items/p/{fileName}",
                fileName,
                null,
                ImageDimensions.Create(1200, 1200).Value!,
                12345,
                $"https://cdn/{fileName}-thumb.webp",
                $"https://cdn/{fileName}-medium.webp",
                $"https://cdn/{fileName}-large.webp",
                setAsMain: false,
                groupValue: "Alta|#457fc9");
        }

        var variant = CatalogItem.CreateVariantChild(
            Guid.CreateVersion7(),
            parent,
            "39-41 / Alta / #457fc9",
            "MOD-05-0001",
            null,
            """{"tallas":"39-41","tipo de ca\u00F1a":"Alta","color":"#457fc9","tags":["nike","runner"],"colores_secundarios":["#ec4899"]}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;
        parent.AddVariantChild(variant);

        _items.GetActiveByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var sut = new GetCatalogItemHandler(_items, _categories, _templates);
        var result = await sut.Handle(new GetCatalogItemQuery(tenantId, parentId), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var descriptor = result.Value!.MatrixDescriptor;
        descriptor.Should().NotBeNull();
        descriptor!.GroupValues.Should().Equal("Alta|#457fc9");
        descriptor.Axes.Single(a => a.Name == "Tipo de Caña").IsPhotoGroup.Should().BeTrue();
        descriptor.Axes.Single(a => a.Name == "Color").IsPhotoGroup.Should().BeTrue();
        descriptor.Axes.Single(a => a.Name == "Tallas").IsPhotoGroup.Should().BeFalse();

        var dto = result.Value.Variants!.Single();
        dto.ImageInheritedFrom.Should().Be("group");
        dto.MainImageThumbUrl.Should().Be("https://cdn/azul-alta.webp-thumb.webp");
        dto.Images.Should().NotBeNull();
        dto.Images!.Should().HaveCount(2);
        dto.Tags.Should().Equal("nike", "runner");
        dto.ExtraColors.Should().Equal("#ec4899");
        dto.DimensionValues!["Tipo de Caña"].Should().Be("Alta");
    }
}
