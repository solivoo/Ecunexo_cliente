using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.SetCatalogItemStorefrontVisibility;
using EcuNexo.Core.Catalog;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class SetCatalogItemStorefrontVisibilityHandlerTests
{
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ICallerContext _caller = Substitute.For<ICallerContext>();

    private SetCatalogItemStorefrontVisibilityHandler CreateSut() => new(_items, _unitOfWork, _caller);

    private static CatalogItem CreateItem(Guid tenantId, Guid itemId) =>
        CatalogItem.Create(
            itemId,
            tenantId,
            CatalogItemKind.Physical,
            "Calcetín Runner",
            description: null,
            sku: "CAL-01",
            basePrice: 3.5m,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

    [Fact(DisplayName = "Ocultar un ítem en la tienda persiste el cambio")]
    public async Task Handle_HidesItem()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        var item = CreateItem(tenantId, itemId);
        _items.GetTrackedByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>()).Returns(item);
        _caller.UserId.Returns(Guid.CreateVersion7());

        var result = await CreateSut()
            .Handle(new SetCatalogItemStorefrontVisibilityCommand(tenantId, itemId, Hidden: true), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Hidden.Should().BeTrue();
        item.IsHiddenFromStorefront.Should().BeTrue();
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Volver a mostrar un ítem oculto limpia el flag")]
    public async Task Handle_ShowsHiddenItem()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        var item = CreateItem(tenantId, itemId);
        item.SetStorefrontVisibility(true, null);
        _items.GetTrackedByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>()).Returns(item);

        var result = await CreateSut()
            .Handle(new SetCatalogItemStorefrontVisibilityCommand(tenantId, itemId, Hidden: false), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Hidden.Should().BeFalse();
        item.IsHiddenFromStorefront.Should().BeFalse();
    }

    [Fact(DisplayName = "Ítem inexistente responde no encontrado")]
    public async Task Handle_UnknownItem_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var itemId = Guid.CreateVersion7();
        _items.GetTrackedByIdAsync(tenantId, itemId, Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var result = await CreateSut()
            .Handle(new SetCatalogItemStorefrontVisibilityCommand(tenantId, itemId, Hidden: true), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.not_found");
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(default);
    }

    [Fact(DisplayName = "Identificadores obligatorios responden validación")]
    public async Task Handle_EmptyIds_ReturnsValidation()
    {
        var result = await CreateSut()
            .Handle(
                new SetCatalogItemStorefrontVisibilityCommand(Guid.Empty, Guid.Empty, Hidden: true),
                CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.visibility.validation");
    }
}
