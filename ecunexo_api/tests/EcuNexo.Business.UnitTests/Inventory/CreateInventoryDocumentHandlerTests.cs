using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Inventory;

public sealed class CreateInventoryDocumentHandlerTests
{
    [Fact(DisplayName = "CreateInventoryDocumentHandler rechaza ítems inactivos")]
    public async Task Handle_WhenItemIsInactive_ReturnsConflict()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var warehouse = Warehouse.Create(
            warehouseId,
            tenantId,
            "Bodega Central",
            code: "BOD-01",
            isMain: true).Value!;

        var inactiveItem = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Tornillo Descontinuado",
            description: null,
            sku: "TOR-DESC",
            basePrice: 1.0m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;
        inactiveItem.SetStatus(CatalogItemStatus.Inactive, updatedBy: null);

        var warehouses = Substitute.For<IWarehouseRepository>();
        warehouses.GetActiveByIdAsync(tenantId, warehouseId, Arg.Any<CancellationToken>())
            .Returns(warehouse);

        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([inactiveItem]);

        var documents = Substitute.For<IInventoryDocumentRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns(Guid.CreateVersion7());

        var tenants = Substitute.For<ITenantRepository>();
        var provisioner = new DefaultWarehouseProvisioner(idGenerator, tenants, warehouses, unitOfWork);
        var validator = new CreateInventoryDocumentValidator();

        var sut = new CreateInventoryDocumentHandler(
            validator,
            idGenerator,
            warehouses,
            provisioner,
            items,
            documents,
            unitOfWork);

        var command = new CreateInventoryDocumentCommand(
            tenantId,
            InventoryDocumentType.Receipt,
            warehouseId,
            Lines: [new CreateInventoryDocumentLineInput(inactiveItem.Id, 5m)],
            Notes: "Recepción de prueba");

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("catalog.item.inactive");
    }

    [Fact(DisplayName = "CreateInventoryDocumentHandler acepta ítems activos")]
    public async Task Handle_WhenItemIsActive_Succeeds()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var warehouseId = Guid.CreateVersion7();
        var warehouse = Warehouse.Create(
            warehouseId,
            tenantId,
            "Bodega Central",
            code: "BOD-01",
            isMain: true).Value!;

        var activeItem = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Tornillo Activo",
            description: null,
            sku: "TOR-ACT",
            basePrice: 1.0m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var warehouses = Substitute.For<IWarehouseRepository>();
        warehouses.GetActiveByIdAsync(tenantId, warehouseId, Arg.Any<CancellationToken>())
            .Returns(warehouse);

        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdsAsync(tenantId, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([activeItem]);

        var documents = Substitute.For<IInventoryDocumentRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns(Guid.CreateVersion7());

        var tenants = Substitute.For<ITenantRepository>();
        var provisioner = new DefaultWarehouseProvisioner(idGenerator, tenants, warehouses, unitOfWork);
        var validator = new CreateInventoryDocumentValidator();

        var sut = new CreateInventoryDocumentHandler(
            validator,
            idGenerator,
            warehouses,
            provisioner,
            items,
            documents,
            unitOfWork);

        var command = new CreateInventoryDocumentCommand(
            tenantId,
            InventoryDocumentType.Receipt,
            warehouseId,
            Lines: [new CreateInventoryDocumentLineInput(activeItem.Id, 5m)],
            Notes: "Recepción de prueba");

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        await documents.Received(1).AddAsync(Arg.Any<InventoryDocument>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
