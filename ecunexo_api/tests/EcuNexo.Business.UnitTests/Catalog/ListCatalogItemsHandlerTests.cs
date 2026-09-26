using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Queries.ListCatalogItems;
using EcuNexo.Core.Catalog;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class ListCatalogItemsHandlerTests
{
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IProductTemplateRepository _templates = Substitute.For<IProductTemplateRepository>();

    [Fact(DisplayName = "ListCatalogItemsHandler proyecta CustomAttributesJson en la respuesta")]
    public async Task Handle_ProjectsCustomAttributesJson()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        const string customAttrsJson = "{\"color\":\"Negro\",\"color_hex\":\"#1e293b\",\"talla\":\"35-38\"}";

        var item = CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            "Descripción",
            "SKU-RUN-01",
            3.5m,
            customAttrsJson,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.ListActiveByTenantAsync(tenantId, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<CatalogItem> { item });

        var sut = new ListCatalogItemsHandler(_items, _templates);
        var query = new ListCatalogItemsQuery(tenantId);

        var result = await sut.Handle(query, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        var first = result.Value![0];
        first.Id.Should().Be(itemId);
        first.Name.Should().Be("Calcetín Runner");
        first.CustomAttributesJson.Should().Be(customAttrsJson);
    }
}
