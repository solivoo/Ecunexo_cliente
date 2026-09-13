using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Inventory.Commands.ApproveInventoryDocument;
using EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;
using EcuNexo.Business.Purchases.Commands.CreatePurchase;
using EcuNexo.Business.Purchases.Commands.ParseSriPurchaseXml;
using EcuNexo.Business.Purchases.Commands.ReceivePurchase;
using EcuNexo.Business.Purchases.Queries.ListPurchases;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Inventory;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Purchases;

public sealed class PurchaseHandlersTests
{
    private readonly IPurchaseRepository _purchases = Substitute.For<IPurchaseRepository>();
    private readonly ISupplierRepository _suppliers = Substitute.For<ISupplierRepository>();
    private readonly IPurchaseProformaRepository _proformas = Substitute.For<IPurchaseProformaRepository>();
    private readonly IExpenseTypeRepository _expenseTypes = Substitute.For<IExpenseTypeRepository>();
    private readonly ICatalogItemRepository _catalogItems = Substitute.For<ICatalogItemRepository>();
    private readonly ICommandHandler<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse> _createInventoryDoc = Substitute.For<ICommandHandler<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse>>();
    private readonly ICommandHandler<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse> _approveInventoryDoc = Substitute.For<ICommandHandler<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse>>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "ParseSriPurchaseXmlHandler parsea XML, detecta proveedor existente y correlaciona ítems con catálogo")]
    public async Task ParseSriPurchaseXmlHandler_ValidXml_DetectsSupplierAndMatchesCatalog()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var existingSupplier = Supplier.Create(supplierId, tenantId, "DISTRIBUIDORA ECUATORIANA TEC S.A.", "1790016919001", contactEmail: "contacto@distribuidora.ec").Value!;
        _suppliers.GetByTaxIdAsync(tenantId, "1790016919001", Arg.Any<CancellationToken>()).Returns(existingSupplier);

        var catalogItemId = Guid.NewGuid();
        var catalogItem = Support.CatalogTestFactory.Physical(catalogItemId, "Memoria RAM 16GB", "PROD-001");
        _catalogItems.ListActiveByTenantAsync(
            Arg.Any<Guid>(),
            Arg.Any<CatalogItemKind?>(),
            Arg.Any<CatalogItemStatus?>(),
            Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<CatalogItem>>(new List<CatalogItem> { catalogItem }));

        const string xml = """
            <?xml version="1.0" encoding="UTF-8"?>
            <factura id="comprobante" version="1.1.0">
              <infoTributaria>
                <ambiente>2</ambiente>
                <tipoEmision>1</tipoEmision>
                <razonSocial>DISTRIBUIDORA ECUATORIANA TEC S.A.</razonSocial>
                <ruc>1790016919001</ruc>
                <claveAcceso>1009202601179001691900120010020000012341234567819</claveAcceso>
                <codDoc>01</codDoc>
                <estab>001</estab>
                <ptoEmi>002</ptoEmi>
                <secuencial>000001234</secuencial>
              </infoTributaria>
              <infoFactura>
                <fechaEmision>10/09/2026</fechaEmision>
                <totalSinImpuestos>250.00</totalSinImpuestos>
                <totalConImpuestos>
                  <totalImpuesto>
                    <codigo>2</codigo>
                    <codigoPorcentaje>4</codigoPorcentaje>
                    <baseImponible>250.00</baseImponible>
                    <valor>37.50</valor>
                  </totalImpuesto>
                </totalConImpuestos>
                <importeTotal>287.50</importeTotal>
              </infoFactura>
              <detalles>
                <detalle>
                  <codigoPrincipal>PROD-001</codigoPrincipal>
                  <descripcion>Memoria RAM 16GB DDR5 Kingston</descripcion>
                  <cantidad>5.00</cantidad>
                  <precioUnitario>50.00</precioUnitario>
                  <precioTotalSinImpuesto>250.00</precioTotalSinImpuesto>
                  <impuestos>
                    <impuesto>
                      <codigo>2</codigo>
                      <codigoPorcentaje>4</codigoPorcentaje>
                      <tarifa>15.00</tarifa>
                      <valor>37.50</valor>
                    </impuesto>
                  </impuestos>
                </detalle>
              </detalles>
            </factura>
            """;

        var handler = new ParseSriPurchaseXmlHandler(_suppliers, _catalogItems);

        // Act
        var result = await handler.Handle(new ParseSriPurchaseXmlCommand(tenantId, xml), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var data = result.Value!;
        data.Supplier.IsRegistered.Should().BeTrue();
        data.Supplier.ExistingSupplierId.Should().Be(supplierId);
        data.InvoiceNumber.Should().Be("001-002-000001234");
        data.Lines.Should().HaveCount(1);
        data.Lines[0].MatchedCatalogItemId.Should().Be(catalogItemId);
        data.Lines[0].CanAffectInventory.Should().BeTrue();
    }

    [Fact(DisplayName = "CreatePurchaseHandler crea compra, ítems y persiste en repositorio")]
    public async Task CreatePurchaseHandler_ValidCommand_CreatesAndSaves()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var purchaseId = Guid.NewGuid();
        _idGenerator.NewId().Returns(purchaseId, Guid.NewGuid());

        var supplier = Supplier.Create(supplierId, tenantId, "Proveedor Mayorista S.A.", "1790016919001", contactEmail: "mayorista@proveedor.ec").Value!;
        _suppliers.GetByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);
        _purchases.ExistsByInvoiceNumberAsync(tenantId, supplierId, "001-001-000000001", null, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreatePurchaseHandler(_purchases, _suppliers, _proformas, _expenseTypes, _idGenerator, _unitOfWork);
        var command = new CreatePurchaseCommand(
            TenantId: tenantId,
            SupplierId: supplierId,
            InvoiceNumber: "001-001-000000001",
            IssueDate: new DateOnly(2026, 9, 10),
            Lines:
            [
                new CreatePurchaseLineInput("Mouse Inalámbrico", Quantity: 5, UnitPrice: 10m, TaxRate: 15m)
            ]);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.PurchaseId.Should().Be(purchaseId);
        result.Value.InvoiceNumber.Should().Be("001-001-000000001");
        await _purchases.Received(1).AddAsync(Arg.Any<Purchase>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "ReceivePurchaseHandler genera ingreso de inventario, lo aprueba y marca compra como recibida")]
    public async Task ReceivePurchaseHandler_InventoryItems_CreatesReceiptAndMarksReceived()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var purchaseId = Guid.NewGuid();
        var warehouseId = Guid.NewGuid();
        var catalogItemId = Guid.NewGuid();
        var inventoryDocId = Guid.NewGuid();

        var purchase = Purchase.Create(
            id: purchaseId,
            tenantId: tenantId,
            supplierId: supplierId,
            invoiceNumber: "001-001-000000001",
            issueDate: new DateOnly(2026, 9, 10)).Value!;

        var item = PurchaseItem.Create(
            id: Guid.NewGuid(),
            purchaseId: purchaseId,
            description: "Teclado Mecánico",
            quantity: 10,
            unitPrice: 40m,
            taxRate: 15m,
            catalogItemId: catalogItemId,
            warehouseId: warehouseId,
            affectsInventory: true).Value!;

        purchase.AddItem(item);

        _purchases.GetTrackedByIdAsync(tenantId, purchaseId, Arg.Any<CancellationToken>()).Returns(purchase);

        _createInventoryDoc.Handle(Arg.Any<CreateInventoryDocumentCommand>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new CreateInventoryDocumentResponse(inventoryDocId, tenantId, InventoryDocumentStatus.Draft)));

        _approveInventoryDoc.Handle(Arg.Any<ApproveInventoryDocumentCommand>(), Arg.Any<CancellationToken>())
            .Returns(Result.Success(new ApproveInventoryDocumentResponse(inventoryDocId, InventoryDocumentStatus.Approved)));

        var handler = new ReceivePurchaseHandler(_purchases, _createInventoryDoc, _approveInventoryDoc, _unitOfWork);

        // Act
        var result = await handler.Handle(new ReceivePurchaseCommand(tenantId, purchaseId), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PurchaseStatus.Received);
        result.Value.InventoryDocumentId.Should().Be(inventoryDocId);
        result.Value.ItemsReceivedInStock.Should().Be(1);
        purchase.Status.Should().Be(PurchaseStatus.Received);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "ListPurchasesHandler calcula KPIs y mapea lista")]
    public async Task ListPurchasesHandler_ReturnsKpisAndList()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();

        var p1 = Purchase.Create(Guid.NewGuid(), tenantId, supplierId, "001-001-000000001", new DateOnly(2026, 9, 10), totalAmount: 100m).Value!;
        var p2 = Purchase.Create(Guid.NewGuid(), tenantId, supplierId, "001-001-000000002", new DateOnly(2026, 9, 11), totalAmount: 200m).Value!;
        p2.MarkAsReceived(Guid.NewGuid());

        _purchases.ListAsync(tenantId, null, null, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<Purchase> { p1, p2 });

        var handler = new ListPurchasesHandler(_purchases);

        // Act
        var result = await handler.Handle(new ListPurchasesQuery(tenantId), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Kpis.TotalPurchases.Should().Be(2);
        result.Value.Kpis.TotalReceived.Should().Be(1);
        result.Value.Kpis.TotalDraft.Should().Be(1);
        result.Value.Kpis.TotalBilledAmount.Should().Be(300m);
        result.Value.Purchases.Should().HaveCount(2);
    }
}
