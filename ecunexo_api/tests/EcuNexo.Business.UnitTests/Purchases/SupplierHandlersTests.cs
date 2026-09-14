using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Business.Purchases.Suppliers.Commands.CreateSupplier;
using EcuNexo.Business.Purchases.Suppliers.Commands.DeleteSupplier;
using EcuNexo.Business.Purchases.Suppliers.Commands.UpdateSupplier;
using EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierByTaxId;
using EcuNexo.Business.Purchases.Suppliers.Queries.ListSuppliers;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Purchases;

public sealed class SupplierHandlersTests
{
    private readonly ISupplierRepository _suppliers = Substitute.For<ISupplierRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "CreateSupplierHandler crea un proveedor correctamente cuando los datos son válidos")]
    public async Task Handle_CreateSupplier_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        _idGenerator.NewId().Returns(supplierId);

        _suppliers.ExistsByTaxIdAsync(tenantId, "1790016919001", null, Arg.Any<CancellationToken>()).Returns(false);
        _suppliers.ExistsByBusinessNameAsync(tenantId, "Distribuidora Andina S.A.", null, Arg.Any<CancellationToken>()).Returns(false);

        var expenseTypeId = Guid.NewGuid();
        var handler = new CreateSupplierHandler(_suppliers, _idGenerator, _unitOfWork);
        var command = new CreateSupplierCommand(
            tenantId,
            "Distribuidora Andina S.A.",
            "1790016919001",
            SupplierIdentificationType.Ruc,
            SupplierTaxRegime.General,
            TradeName: "Andina Import",
            IsRetentionAgent: true,
            ResolutionNumber: "NAC-DNCRASC20-00000001",
            ContactEmail: "compras@andina.com.ec",
            ContactPhone: "0999999999",
            Address: "Av. Shyris y Portugal, Quito",
            ContactPerson: "Carlos Ruiz",
            CreditDays: 30,
            CreditLimit: 5000m,
            DefaultExpenseTypeId: expenseTypeId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(supplierId);
        result.Value.BusinessName.Should().Be("Distribuidora Andina S.A.");
        result.Value.TaxId.Should().Be("1790016919001");
        result.Value.IsRetentionAgent.Should().BeTrue();
        result.Value.CreditDays.Should().Be(30);
        result.Value.DefaultExpenseTypeId.Should().Be(expenseTypeId);

        await _suppliers.Received(1).AddAsync(Arg.Is<Supplier>(s => s.Id == supplierId && s.BusinessName == "Distribuidora Andina S.A." && s.DefaultExpenseTypeId == expenseTypeId), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateSupplierHandler retorna conflicto cuando el RUC ya está registrado")]
    public async Task Handle_CreateSupplier_DuplicateTaxId_ReturnsConflict()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _suppliers.ExistsByTaxIdAsync(tenantId, "1790016919001", null, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new CreateSupplierHandler(_suppliers, _idGenerator, _unitOfWork);
        var command = new CreateSupplierCommand(
            tenantId,
            "Distribuidora Andina S.A.",
            "1790016919001");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchases.supplier.tax_id_duplicate");
        result.Error.Type.Should().Be(ErrorType.Conflict);
        await _suppliers.DidNotReceive().AddAsync(Arg.Any<Supplier>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "UpdateSupplierHandler actualiza datos y guarda cambios correctamente")]
    public async Task Handle_UpdateSupplier_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();

        var supplier = Supplier.Create(supplierId, tenantId, "Proveedor Original", "1790016919001", contactEmail: "contacto@proveedor.ec").Value!;
        _suppliers.GetTrackedByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);
        _suppliers.ExistsByTaxIdAsync(tenantId, "1790016919001", supplierId, Arg.Any<CancellationToken>()).Returns(false);
        var newExpenseTypeId = Guid.NewGuid();
        var handler = new UpdateSupplierHandler(_suppliers, _unitOfWork);
        var command = new UpdateSupplierCommand(
            tenantId,
            supplierId,
            "Proveedor Modificado S.A.",
            "1790016919001",
            SupplierIdentificationType.Ruc,
            SupplierTaxRegime.RimpeEmprendedor,
            TradeName: "Nombre Comercial",
            ContactEmail: "modificado@proveedor.ec",
            CreditDays: 45,
            DefaultExpenseTypeId: newExpenseTypeId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.BusinessName.Should().Be("Proveedor Modificado S.A.");
        result.Value.CreditDays.Should().Be(45);
        result.Value.TaxRegime.Should().Be(SupplierTaxRegime.RimpeEmprendedor);
        result.Value.DefaultExpenseTypeId.Should().Be(newExpenseTypeId);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "DeleteSupplierHandler realiza baja lógica correctamente")]
    public async Task Handle_DeleteSupplier_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();

        var supplier = Supplier.Create(
            supplierId,
            tenantId,
            "Proveedor a Eliminar",
            "1790016919001",
            contactEmail: "eliminar@proveedor.ec").Value!;

        _suppliers.GetTrackedByIdAsync(tenantId, supplierId, Arg.Any<CancellationToken>()).Returns(supplier);

        var handler = new DeleteSupplierHandler(_suppliers, _unitOfWork);
        var command = new DeleteSupplierCommand(tenantId, supplierId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        supplier.DeletedAt.Should().NotBeNull();
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "ListSuppliersHandler retorna lista mapeada")]
    public async Task Handle_ListSuppliers_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplier = Supplier.Create(Guid.NewGuid(), tenantId, "Proveedor 1", "1790016919001", contactEmail: "proveedor1@test.ec").Value!;
        _suppliers.ListAsync(tenantId, null, null, Arg.Any<CancellationToken>()).Returns([supplier]);

        var handler = new ListSuppliersHandler(_suppliers);
        var query = new ListSuppliersQuery(tenantId, null, null);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        result.Value![0].BusinessName.Should().Be("Proveedor 1");
    }

    [Fact(DisplayName = "CreateSupplierHandler con ReturnExistingIfExists retorna proveedor existente sin error ni duplicar")]
    public async Task Handle_CreateSupplier_ReturnExistingIfExists_ReturnsExistingWithoutDuplicating()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var existingSupplierId = Guid.NewGuid();
        var existingSupplier = Supplier.Create(
            existingSupplierId,
            tenantId,
            "Distribuidora Andina S.A.",
            "1790016919001",
            contactEmail: "compras@andina.com.ec").Value!;

        _suppliers.ExistsByTaxIdAsync(tenantId, "1790016919001", null, Arg.Any<CancellationToken>()).Returns(true);
        _suppliers.GetByTaxIdAsync(tenantId, "1790016919001", Arg.Any<CancellationToken>()).Returns(existingSupplier);

        var handler = new CreateSupplierHandler(_suppliers, _idGenerator, _unitOfWork);
        var command = new CreateSupplierCommand(
            tenantId,
            "Distribuidora Andina S.A.",
            "1790016919001",
            ReturnExistingIfExists: true);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(existingSupplierId);
        result.Value.BusinessName.Should().Be("Distribuidora Andina S.A.");
        await _suppliers.DidNotReceive().AddAsync(Arg.Any<Supplier>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "GetSupplierByTaxIdHandler retorna proveedor si existe por RUC/Cédula")]
    public async Task Handle_GetSupplierByTaxId_ReturnsSupplierWhenExists()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var existingSupplier = Supplier.Create(
            supplierId,
            tenantId,
            "Corporación La Favorita",
            "1790016919001").Value!;

        _suppliers.GetByTaxIdAsync(tenantId, "1790016919001", Arg.Any<CancellationToken>()).Returns(existingSupplier);

        var handler = new GetSupplierByTaxIdHandler(_suppliers);
        var query = new GetSupplierByTaxIdQuery(tenantId, "1790016919001");

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Id.Should().Be(supplierId);
        result.Value.BusinessName.Should().Be("Corporación La Favorita");
    }
}
