using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Catalog;

public sealed class AddCatalogItemVariantHandlerTests
{
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly ICatalogItemRepository _items = Substitute.For<ICatalogItemRepository>();
    private readonly ICategoryRepository _categories = Substitute.For<ICategoryRepository>();
    private readonly IStockRepository _stocks = Substitute.For<IStockRepository>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly AddCatalogItemVariantValidator _validator = new();

    private AddCatalogItemVariantHandler CreateSut() =>
        new(
            _validator,
            _idGenerator,
            _items,
            _categories,
            _stocks,
            _warehouses,
            _unitOfWork);

    [Fact(DisplayName = "Añadir variante a producto matriz existente tiene éxito")]
    public async Task Handle_ValidVariant_AddsChildAndSaves()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();
        var childId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Medias Algodón",
            "Descripción",
            "MED-01",
            3.00m,
            null,
            "[{\"name\":\"Talla\",\"values\":[\"35-38\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);
        _items.SkuExistsIgnoreCaseAsync(tenantId, "MED-01-4244", null, Arg.Any<CancellationToken>())
            .Returns(false);
        _idGenerator.NewId().Returns(childId);

        var command = new AddCatalogItemVariantCommand(
            tenantId,
            parentId,
            "42-44",
            "MED-01-4244",
            BasePrice: 3.50m,
            CustomAttributesJson: "{\"talla\": \"42-44\"}");

        var sut = CreateSut();

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.VariantItemId.Should().Be(childId);
        result.Value.ParentItemId.Should().Be(parentId);
        result.Value.Sku.Should().Be("MED-01-4244");

        await _items.Received(1).AddAsync(Arg.Is<CatalogItem>(c => c.ParentId == parentId && c.Sku == "MED-01-4244"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Añadir variante rechaza si el producto matriz no existe")]
    public async Task Handle_ParentNotFound_ReturnsNotFound()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns((CatalogItem?)null);

        var command = new AddCatalogItemVariantCommand(
            tenantId,
            parentId,
            "42-44",
            "MED-01-4244");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.parent_not_found");
    }

    [Fact(DisplayName = "Añadir variante rechaza si el padre no es un producto matriz")]
    public async Task Handle_ParentNotMatrix_ReturnsError()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var regularItem = CatalogItem.Create(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Ítem Normal",
            null,
            "SKU-SIMPLE",
            10.0m,
            null,
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(regularItem);

        var command = new AddCatalogItemVariantCommand(
            tenantId,
            parentId,
            "Extra",
            "SKU-EXTRA");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.not_matrix_parent");
    }

    [Fact(DisplayName = "Añadir variante rechaza si el SKU ya existe en el catálogo")]
    public async Task Handle_DuplicateSku_ReturnsConflict()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Medias",
            null,
            "MED-01",
            3.00m,
            null,
            "[{\"name\":\"Talla\",\"values\":[\"35-38\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);
        _items.SkuExistsIgnoreCaseAsync(tenantId, "MED-01-3538", null, Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new AddCatalogItemVariantCommand(
            tenantId,
            parentId,
            "35-38",
            "MED-01-3538");

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.variant.sku.duplicate");
    }

    [Fact(DisplayName = "Añadir variante con stock inicial crea registro de inventario")]
    public async Task Handle_WithInitialStock_CreatesStockRecord()
    {
        var tenantId = Guid.CreateVersion7();
        var parentId = Guid.CreateVersion7();
        var childId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();

        var parent = CatalogItem.CreateMatrixParent(
            parentId,
            tenantId,
            CatalogItemKind.Physical,
            "Medias Algodón",
            null,
            "MED-01",
            3.00m,
            null,
            "[{\"name\":\"Talla\",\"values\":[\"35-38\"]}]",
            null,
            CatalogAttributeSchema.EmptyArrayJson).Value!;

        var warehouse = Warehouse.Create(
            warehouseId,
            tenantId,
            "Bodega Central",
            "BOD-01",
            isMain: true).Value!;

        _items.GetTrackedByIdAsync(tenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(parent);
        _items.SkuExistsIgnoreCaseAsync(tenantId, "MED-01-4244", null, Arg.Any<CancellationToken>())
            .Returns(false);
        _warehouses.GetActiveByIdAsync(tenantId, warehouseId, Arg.Any<CancellationToken>())
            .Returns(warehouse);
        _idGenerator.NewId().Returns(childId, Guid.CreateVersion7());

        var command = new AddCatalogItemVariantCommand(
            tenantId,
            parentId,
            "42-44",
            "MED-01-4244",
            BasePrice: 3.50m,
            InitialStock: 50m,
            InitialStockWarehouseId: warehouseId);

        var sut = CreateSut();

        var result = await sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _stocks.Received(1).AddAsync(Arg.Is<Stock>(s => s.CatalogItemId == childId && s.Quantity == 50m), Arg.Any<CancellationToken>());
    }
}
