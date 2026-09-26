using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.ReassignCatalogItemVariantParent;
using EcuNexo.Core.Catalog;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class ReassignCatalogItemVariantParentHandlerTests
{
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ReassignCatalogItemVariantParentValidator _validator = new();

    private ReassignCatalogItemVariantParentHandler CreateSut() =>
        new(_validator, _items, _unitOfWork);

    [Fact(DisplayName = "Reasignar variante a nuevo producto matriz guarda cambios y retorna respuesta")]
    public async Task Handle_ValidReassignment_UpdatesParentAndSaves()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var parentAId = Guid.CreateVersion7();
        var parentBId = Guid.CreateVersion7();
        var variantId = Guid.CreateVersion7();
        var userId = Guid.CreateVersion7();

        var parentA = CatalogItem.CreateMatrixParent(
            parentAId,
            tenantId,
            CatalogItemKind.Physical,
            "Camisetas Deportivas",
            null,
            "CAM-01",
            15m,
            """[{"name":"Talla","values":["S","M"]}]""",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var parentB = CatalogItem.CreateMatrixParent(
            parentBId,
            tenantId,
            CatalogItemKind.Physical,
            "Camisetas Casuales",
            null,
            "CAM-02",
            18m,
            """[{"name":"Talla","values":["S","M"]}]""",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var variant = CatalogItem.CreateVariantChild(
            variantId,
            parentA,
            "Talla M",
            "CAM-01-M",
            15m,
            """{"talla":"M"}""",
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, variantId, Arg.Any<CancellationToken>())
            .Returns(variant);
        _items.GetTrackedByIdAsync(tenantId, parentBId, Arg.Any<CancellationToken>())
            .Returns(parentB);
        _items.GetTrackedByIdAsync(tenantId, parentAId, Arg.Any<CancellationToken>())
            .Returns(parentA);

        var command = new ReassignCatalogItemVariantParentCommand(
            tenantId,
            variantId,
            parentBId,
            "Reubicación por categoría correcta",
            userId);

        var sut = CreateSut();

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.ItemId.Should().Be(variantId);
        result.Value.PreviousParentId.Should().Be(parentAId);
        result.Value.TargetParentId.Should().Be(parentBId);
        result.Value.Reason.Should().Be("Reubicación por categoría correcta");
        variant.ParentId.Should().Be(parentBId);

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Reasignar variante a standalone sin padre tiene éxito")]
    public async Task Handle_ReassignToStandalone_Succeeds()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();
        var variantId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Packs Medias",
            null,
            "PCK-01",
            10m,
            """[{"name":"Pack","values":["Pack 3"]}]""",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var variant = CatalogItem.CreateVariantChild(
            variantId,
            parent,
            "Pack 3",
            "PCK-01-3P",
            10m,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, variantId, Arg.Any<CancellationToken>())
            .Returns(variant);
        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);

        var command = new ReassignCatalogItemVariantParentCommand(
            tenantId,
            variantId,
            TargetParentItemId: null,
            "Independizar como producto unitario");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.PreviousParentId.Should().Be(parentId);
        result.Value.TargetParentId.Should().BeNull();
        variant.ParentId.Should().BeNull();

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Reasignar variante retorna error cuando la variante no existe")]
    public async Task Handle_VariantNotFound_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var variantId = Guid.CreateVersion7();

        _items.GetTrackedByIdAsync(tenantId, variantId, Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var command = new ReassignCatalogItemVariantParentCommand(
            tenantId,
            variantId,
            Guid.CreateVersion7(),
            "Motivo de prueba");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.not_found");
    }

    [Fact(DisplayName = "Reasignar variante retorna error cuando el padre destino no existe")]
    public async Task Handle_TargetParentNotFound_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var targetParentId = Guid.CreateVersion7();
        var variantId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Parent A",
            null,
            "PAR-01",
            10m,
            """[{"name":"Talla","values":["S"]}]""",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var variant = CatalogItem.CreateVariantChild(
            variantId,
            parent,
            "Talla S",
            "PAR-01-S",
            10m,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, variantId, Arg.Any<CancellationToken>())
            .Returns(variant);
        _items.GetTrackedByIdAsync(tenantId, targetParentId, Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var command = new ReassignCatalogItemVariantParentCommand(
            tenantId,
            variantId,
            targetParentId,
            "Motivo de prueba");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.matrix.target_not_found");
    }

    [Fact(DisplayName = "Validator rechaza motivo menor a 3 caracteres")]
    public async Task Handle_ShortReason_FailsValidation()
    {
        var command = new ReassignCatalogItemVariantParentCommand(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            "ok");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.reassign.validation");
    }
}
