using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Inventory;
using EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Tenancy;
using EcuNexo.Core.Warehousing;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Inventory;

/// <summary>
/// Fase 4 — egreso post-autorización SRI: solo physical, idempotente por billing_invoice_id.
/// </summary>
public sealed class ApplyAuthorizedInvoiceEgressHandlerTests
{
    [Fact(DisplayName = "Segunda llamada no duplica egreso (idempotente)")]
    public async Task Handle_WhenAlreadyApplied_ReturnsAlreadyAppliedWithoutNewDocument()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var invoiceId = Guid.CreateVersion7();
        var existingDocId = Guid.CreateVersion7();
        var existing = InvoiceStockEgress.Create(
            Guid.CreateVersion7(),
            tenantId,
            invoiceId,
            existingDocId).Value!;

        var (sut, documents, _, _) = CreateSut(
            tenantId,
            existingEgress: existing);

        var command = new ApplyAuthorizedInvoiceEgressCommand(
            tenantId,
            invoiceId,
            [
                new AuthorizedInvoiceEgressLineInput(
                    Guid.CreateVersion7(),
                    2m,
                    "physical"),
            ]);

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.AlreadyApplied.Should().BeTrue();
        result.Value.InventoryDocumentId.Should().Be(existingDocId);
        await documents.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact(DisplayName = "Líneas service se omiten sin crear documento")]
    public async Task Handle_OnlyServiceLines_SkipsWithoutDocument()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var (sut, documents, _, _) = CreateSut(tenantId);

        var command = new ApplyAuthorizedInvoiceEgressCommand(
            tenantId,
            Guid.CreateVersion7(),
            [
                new AuthorizedInvoiceEgressLineInput(
                    Guid.CreateVersion7(),
                    1m,
                    "service",
                    "Consultoría"),
            ]);

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue();
        result.Value!.Skipped.Should().BeTrue();
        await documents.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact(DisplayName = "Línea physical crea egreso Issue aprobado en bodega principal")]
    public async Task Handle_PhysicalLine_CreatesApprovedIssue()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var item = CatalogItem.Create(
            Guid.CreateVersion7(),
            tenantId,
            CatalogItemKind.Physical,
            "Tornillo M6",
            description: null,
            sku: "TOR-M6",
            basePrice: 1.5m,
            categoryId: null,
            customAttributesJson: null,
            categorySchemaJson: CatalogAttributeSchema.EmptyArrayJson).Value!;

        var (sut, documents, egresses, unitOfWork) = CreateSut(
            tenantId,
            catalogItems: [item],
            seedStockQuantity: 10m);

        var command = new ApplyAuthorizedInvoiceEgressCommand(
            tenantId,
            Guid.CreateVersion7(),
            [
                new AuthorizedInvoiceEgressLineInput(item.Id, 3m, "physical", item.Name),
                new AuthorizedInvoiceEgressLineInput(Guid.CreateVersion7(), 1m, "service", "Instalación"),
            ]);

        // Actuar
        var result = await sut.Handle(command, CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
        result.Value!.Skipped.Should().BeFalse();
        result.Value.AlreadyApplied.Should().BeFalse();
        result.Value.InventoryDocumentId.Should().NotBeNull();
        await documents.Received(1).AddAsync(
            Arg.Is<InventoryDocument>(d =>
                d.DocumentType == InventoryDocumentType.Issue
                && d.Status == InventoryDocumentStatus.Approved
                && d.Lines.Count == 1
                && d.Lines[0].Quantity == 3m),
            Arg.Any<CancellationToken>());
        await egresses.Received(1).AddAsync(Arg.Any<InvoiceStockEgress>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private static (
        ApplyAuthorizedInvoiceEgressHandler Sut,
        IInventoryDocumentRepository Documents,
        IInvoiceStockEgressRepository Egresses,
        IUnitOfWork UnitOfWork)
        CreateSut(
            Guid tenantId,
            InvoiceStockEgress? existingEgress = null,
            IReadOnlyList<CatalogItem>? catalogItems = null,
            decimal seedStockQuantity = 0m)
    {
        var validator = new ApplyAuthorizedInvoiceEgressValidator();
        var tenants = Substitute.For<ITenantRepository>();
        var tenant = Tenant.Create(
            tenantId,
            "Tenant test",
            new ServicePlan("Business", 10, 5),
            enabledModuleCodes: ["identity", "catalog", "inventory", "warehousing"]).Value!;
        tenants.GetByIdAsync(tenantId, Arg.Any<CancellationToken>()).Returns(tenant);

        var egresses = Substitute.For<IInvoiceStockEgressRepository>();
        egresses
            .GetByBillingInvoiceAsync(tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(existingEgress);

        var mainWarehouse = Warehouse.Create(
            Guid.CreateVersion7(),
            tenantId,
            Warehouse.MainDefaultName,
            code: "PRINCIPAL",
            isMain: true).Value!;

        var warehouses = Substitute.For<IWarehouseRepository>();
        warehouses.HasMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(true);
        warehouses.HasSystemRoleAsync(tenantId, WarehouseSystemRole.Transit, Arg.Any<CancellationToken>())
            .Returns(true);
        warehouses.GetMainAsync(tenantId, Arg.Any<CancellationToken>()).Returns(mainWarehouse);

        var items = Substitute.For<ICatalogItemRepository>();
        items.GetActiveByIdsAsync(tenantId, Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var ids = call.ArgAt<IReadOnlyList<Guid>>(1);
                var source = catalogItems ?? [];
                return source.Where(i => ids.Contains(i.Id)).ToList();
            });

        var documents = Substitute.For<IInventoryDocumentRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns(_ => Guid.CreateVersion7());

        var stocks = new InMemoryStockRepository();
        if (seedStockQuantity > 0 && catalogItems is not null)
        {
            foreach (var catalogItem in catalogItems)
            {
                var stock = Stock.Create(
                    Guid.CreateVersion7(),
                    tenantId,
                    catalogItem.Id,
                    mainWarehouse.Id).Value!;
                stock.Increase(seedStockQuantity, null);
                stocks.AddAsync(stock, CancellationToken.None).GetAwaiter().GetResult();
            }
        }

        var movements = Substitute.For<IInventoryMovementRepository>();
        var approval = new InventoryDocumentApprovalService(idGenerator, stocks, movements);
        var provisioner = new DefaultWarehouseProvisioner(idGenerator, tenants, warehouses, unitOfWork);

        var sut = new ApplyAuthorizedInvoiceEgressHandler(
            validator,
            tenants,
            egresses,
            provisioner,
            warehouses,
            items,
            documents,
            approval,
            idGenerator,
            unitOfWork);

        return (sut, documents, egresses, unitOfWork);
    }

    private sealed class InMemoryStockRepository : IStockRepository
    {
        private readonly List<Stock> _stocks = [];

        public Task AddAsync(Stock stock, CancellationToken ct)
        {
            _stocks.Add(stock);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<Stock>> ListByTenantAsync(Guid tenantId, Guid? warehouseId, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<Stock>>(
                _stocks.Where(s => s.TenantId == tenantId
                    && (warehouseId is null || s.WarehouseId == warehouseId)).ToList());

        public Task<Stock?> GetTrackedAsync(
            Guid tenantId,
            Guid catalogItemId,
            Guid warehouseId,
            CancellationToken ct) =>
            Task.FromResult(
                _stocks.FirstOrDefault(s =>
                    s.TenantId == tenantId
                    && s.CatalogItemId == catalogItemId
                    && s.WarehouseId == warehouseId));

        public Task<Stock?> GetTrackedByIdAsync(Guid tenantId, Guid stockId, CancellationToken ct) =>
            Task.FromResult(_stocks.FirstOrDefault(s => s.TenantId == tenantId && s.Id == stockId));

        public Task<bool> ExistsForItemAsync(Guid tenantId, Guid catalogItemId, CancellationToken ct) =>
            Task.FromResult(_stocks.Any(s => s.TenantId == tenantId && s.CatalogItemId == catalogItemId));
    }
}
