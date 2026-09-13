using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Proformas.Commands.ApprovePurchaseProforma;
using EcuNexo.Business.Purchases.Proformas.Commands.CreatePurchaseProforma;
using EcuNexo.Business.Purchases.Proformas.Commands.RejectPurchaseProforma;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Purchases;

public sealed class PurchaseProformaHandlersTests
{
    private readonly IPurchaseProformaRepository _proformas = Substitute.For<IPurchaseProformaRepository>();
    private readonly ISupplierRepository _suppliers = Substitute.For<ISupplierRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IEmailSender _emailSender = Substitute.For<IEmailSender>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "CreatePurchaseProformaHandler crea la proforma y calcula subtotales e impuestos")]
    public async Task Handle_CreateProforma_CalculatesTotalsAndSaves()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var proformaId = Guid.NewGuid();
        _idGenerator.NewId().Returns(proformaId, Guid.NewGuid(), Guid.NewGuid());

        var supplier = Supplier.Create(supplierId, tenantId, "Proveedor ABC", "1790016919001", contactEmail: "ventas@proveedorabc.ec").Value!;
        _suppliers.GetByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);
        _proformas.ExistsByNumberAsync(tenantId, supplierId, "PROF-2026-001", null, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreatePurchaseProformaHandler(_proformas, _suppliers, _idGenerator, _unitOfWork);
        var command = new CreatePurchaseProformaCommand(
            tenantId,
            supplierId,
            "PROF-2026-001",
            new DateOnly(2026, 9, 13),
            new DateOnly(2026, 9, 30),
            Notes: "Cotización para reposición de stock",
            AttachmentUrl: "https://bucket.ecunexo.com/proformas/prof-001.pdf",
            AttachmentFileName: "prof-001.pdf",
            Items:
            [
                new CreatePurchaseProformaItemInput("Mouse Gamer Óptico", Quantity: 10, UnitPrice: 20.00m, TaxRate: 15.00m, null, null),
                new CreatePurchaseProformaItemInput("Cajas de Embalaje", Quantity: 50, UnitPrice: 1.00m, TaxRate: 15.00m, null, null)
            ]);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.ProformaNumber.Should().Be("PROF-2026-001");
        result.Value.Subtotal.Should().Be(250.00m); // 200 + 50
        result.Value.TaxAmount.Should().Be(37.50m); // 15% of 250
        result.Value.TotalAmount.Should().Be(287.50m);
        result.Value.Status.Should().Be(PurchaseProformaStatus.Draft);
        result.Value.Items.Should().HaveCount(2);

        await _proformas.Received(1).AddAsync(Arg.Any<PurchaseProforma>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreatePurchaseProformaHandler en modo documento/URL sin ítems crea la proforma exitosamente")]
    public async Task Handle_CreateProforma_DocumentUrlModeWithoutItems_Succeeds()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var proformaId = Guid.NewGuid();
        _idGenerator.NewId().Returns(proformaId);

        var supplier = Supplier.Create(supplierId, tenantId, "Proveedor ABC", "1790016919001", contactEmail: "ventas@proveedorabc.ec").Value!;
        _suppliers.GetByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);
        _proformas.ExistsByNumberAsync(tenantId, supplierId, "PROF-DOC-001", null, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreatePurchaseProformaHandler(_proformas, _suppliers, _idGenerator, _unitOfWork);
        var command = new CreatePurchaseProformaCommand(
            tenantId,
            supplierId,
            "PROF-DOC-001",
            new DateOnly(2026, 9, 13),
            new DateOnly(2026, 9, 30),
            Notes: "Cotización enviada en PDF",
            AttachmentUrl: "https://bucket.ecunexo.com/proformas/cotizacion-firmada.pdf",
            AttachmentFileName: "cotizacion-firmada.pdf",
            Subtotal: 800m,
            TaxAmount: 120m,
            TotalAmount: 920m,
            Items: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Subtotal.Should().Be(800m);
        result.Value.TaxAmount.Should().Be(120m);
        result.Value.TotalAmount.Should().Be(920m);
        result.Value.Items.Should().BeEmpty();
    }

    [Fact(DisplayName = "CreatePurchaseProformaHandler falla si el proveedor no existe")]
    public async Task Handle_CreateProforma_SupplierNotFound_ReturnsNotFound()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        _suppliers.GetByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns((Supplier?)null);

        var handler = new CreatePurchaseProformaHandler(_proformas, _suppliers, _idGenerator, _unitOfWork);
        var command = new CreatePurchaseProformaCommand(
            tenantId,
            supplierId,
            "PROF-001",
            new DateOnly(2026, 9, 13),
            null,
            null,
            null,
            null,
            0,
            0,
            0,
            [new CreatePurchaseProformaItemInput("Item 1", 1, 10, 15, null, null)]);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchases.proforma.supplier_not_found");
        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact(DisplayName = "ApprovePurchaseProformaHandler aprueba proforma y envía correo al proveedor")]
    public async Task Handle_ApproveProforma_DraftStatus_ApprovesAndSendsEmail()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var proformaId = Guid.NewGuid();
        var proforma = PurchaseProforma.Create(proformaId, tenantId, supplierId, "PROF-999", new DateOnly(2026, 9, 13)).Value!;
        proforma.AddItem(Guid.NewGuid(), "Item cotizado", 2, 100, 15);

        var supplier = Supplier.Create(supplierId, tenantId, "Proveedor Notificado S.A.", "1790016919001", contactEmail: "ordenes@proveedornotificado.ec").Value!;

        _proformas.GetTrackedByIdAsync(tenantId, proformaId, Arg.Any<CancellationToken>()).Returns(proforma);
        _suppliers.GetByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);

        var handler = new ApprovePurchaseProformaHandler(_proformas, _suppliers, _emailSender, _unitOfWork);
        var command = new ApprovePurchaseProformaCommand(tenantId, proformaId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PurchaseProformaStatus.Approved);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _emailSender.Received(1).SendAsync(Arg.Is<EmailMessage>(m => m.ToAddress == "ordenes@proveedornotificado.ec"), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "RejectPurchaseProformaHandler registra motivo de rechazo")]
    public async Task Handle_RejectProforma_AppliesReasonAndRejects()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var proformaId = Guid.NewGuid();
        var proforma = PurchaseProforma.Create(proformaId, tenantId, Guid.NewGuid(), "PROF-999", new DateOnly(2026, 9, 13)).Value!;

        _proformas.GetTrackedByIdAsync(tenantId, proformaId, Arg.Any<CancellationToken>()).Returns(proforma);

        var handler = new RejectPurchaseProformaHandler(_proformas, _unitOfWork);
        var command = new RejectPurchaseProformaCommand(tenantId, proformaId, "Precios superiores al presupuesto");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be(PurchaseProformaStatus.Rejected);
        result.Value.Notes.Should().Contain("Precios superiores al presupuesto");
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
