using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Expenses.Commands.CreateExpenseType;
using EcuNexo.Business.Purchases.Expenses.Commands.SeedDefaultExpenseTypes;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Purchases;

public sealed class ExpenseTypeHandlersTests
{
    private readonly IExpenseTypeRepository _expenseTypes = Substitute.For<IExpenseTypeRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "SeedDefaultExpenseTypesHandler inserta los 9 conceptos básicos de compras SRI cuando el conteo es 0")]
    public async Task Handle_SeedDefaultExpenseTypes_WhenCountIsZero_SeedsNineTypes()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _expenseTypes.CountAsync(tenantId, Arg.Any<CancellationToken>()).Returns(0);
        _idGenerator.NewId().Returns(_ => Guid.NewGuid());

        var handler = new SeedDefaultExpenseTypesHandler(_expenseTypes, _idGenerator, _unitOfWork);
        var command = new SeedDefaultExpenseTypesCommand(tenantId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(9);

        await _expenseTypes.Received(1).AddRangeAsync(
            Arg.Is<IEnumerable<ExpenseType>>(list => list.Count() == 9),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "SeedDefaultExpenseTypesHandler no inserta nada si ya existen gastos registrados")]
    public async Task Handle_SeedDefaultExpenseTypes_WhenCountGreaterThanZero_DoesNotSeed()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _expenseTypes.CountAsync(tenantId, Arg.Any<CancellationToken>()).Returns(3);

        var handler = new SeedDefaultExpenseTypesHandler(_expenseTypes, _idGenerator, _unitOfWork);
        var command = new SeedDefaultExpenseTypesCommand(tenantId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(0);

        await _expenseTypes.DidNotReceive().AddRangeAsync(Arg.Any<IEnumerable<ExpenseType>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateExpenseTypeHandler crea un tipo de gasto con código único")]
    public async Task Handle_CreateExpenseType_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _idGenerator.NewId().Returns(id);
        _expenseTypes.ExistsByCodeAsync(tenantId, "LOGISTICA", null, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreateExpenseTypeHandler(_expenseTypes, _idGenerator, _unitOfWork);
        var command = new CreateExpenseTypeCommand(
            tenantId,
            "LOGISTICA",
            "Fletes y Distribución Local",
            SriSustentoCode: "02",
            AffectsInventory: false,
            SuggestedRetentionCode: "344",
            Description: "Costos de envío a clientes");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Code.Should().Be("LOGISTICA");
        result.Value.Name.Should().Be("Fletes y Distribución Local");
        result.Value.SriSustentoCode.Should().Be("02");
        await _expenseTypes.Received(1).AddAsync(Arg.Any<ExpenseType>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateExpenseTypeHandler retorna conflicto si el código ya existe")]
    public async Task Handle_CreateExpenseType_DuplicateCode_ReturnsConflict()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _expenseTypes.ExistsByCodeAsync(tenantId, "MERC", null, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new CreateExpenseTypeHandler(_expenseTypes, _idGenerator, _unitOfWork);
        var command = new CreateExpenseTypeCommand(tenantId, "MERC", "Mercadería duplicada");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchases.expense_type.code_duplicate");
        result.Error.Type.Should().Be(ErrorType.Conflict);
    }

    [Fact(DisplayName = "UpdateExpenseTypeHandler actualiza campos correctamente")]
    public async Task Handle_UpdateExpenseType_Success()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var existing = ExpenseType.Create(
            id,
            tenantId,
            "OLD_CODE",
            "Nombre Anterior",
            "01",
            affectsInventory: false,
            isSystem: false,
            suggestedRetentionCode: "312",
            retentionPercentage: 2.00m,
            validFrom: new DateOnly(2026, 8, 6),
            validUntil: null,
            description: "Desc").Value!;

        _expenseTypes.GetTrackedByIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(existing);
        _expenseTypes.ExistsByCodeAsync(tenantId, "NEW_CODE", id, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType.UpdateExpenseTypeHandler(_expenseTypes, _unitOfWork);
        var command = new EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType.UpdateExpenseTypeCommand(
            tenantId,
            id,
            "Nombre Actualizado",
            "02",
            true,
            "307",
            3.00m,
            new DateOnly(2026, 8, 6),
            new DateOnly(2027, 12, 31),
            "Desc actualizada",
            "NEW_CODE",
            true,
            Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Nombre Actualizado");
        result.Value.Code.Should().Be("NEW_CODE");
        result.Value.RetentionPercentage.Should().Be(3.00m);
        result.Value.ValidUntil.Should().Be(new DateOnly(2027, 12, 31));
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "UpdateExpenseTypeHandler retorna error si no existe")]
    public async Task Handle_UpdateExpenseType_NotFound()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        _expenseTypes.GetTrackedByIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns((ExpenseType?)null);

        var handler = new EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType.UpdateExpenseTypeHandler(_expenseTypes, _unitOfWork);
        var command = new EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType.UpdateExpenseTypeCommand(
            tenantId, id, "Nombre", "01", false, null, null, null, null, null, null, true, null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact(DisplayName = "DeleteExpenseTypeHandler rechaza eliminar conceptos de sistema SRI")]
    public async Task Handle_DeleteExpenseType_IsSystem_ReturnsValidationError()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var systemType = ExpenseType.Create(
            id,
            tenantId,
            "BIEN",
            "Compra de Bienes",
            "01",
            affectsInventory: true,
            isSystem: true,
            suggestedRetentionCode: "312",
            retentionPercentage: 2.00m,
            validFrom: new DateOnly(2026, 8, 6),
            validUntil: null).Value!;

        _expenseTypes.GetTrackedByIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(systemType);

        var purchases = Substitute.For<IPurchaseRepository>();
        var handler = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeHandler(_expenseTypes, purchases, _unitOfWork);
        var command = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeCommand(tenantId, id, Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("purchases.expense_type.system_immutable");
        _expenseTypes.DidNotReceive().Remove(Arg.Any<ExpenseType>());
    }

    [Fact(DisplayName = "DeleteExpenseTypeHandler desactiva el concepto si tiene compras asociadas")]
    public async Task Handle_DeleteExpenseType_UsedInPurchases_Deactivates()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var customType = ExpenseType.Create(
            id,
            tenantId,
            "CUSTOM",
            "Personalizado",
            "01",
            affectsInventory: false,
            isSystem: false,
            suggestedRetentionCode: "312",
            retentionPercentage: 2.00m).Value!;

        _expenseTypes.GetTrackedByIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(customType);
        var purchases = Substitute.For<IPurchaseRepository>();
        purchases.ExistsByExpenseTypeIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeHandler(_expenseTypes, purchases, _unitOfWork);
        var command = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeCommand(tenantId, id, Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        customType.IsActive.Should().BeFalse();
        _expenseTypes.DidNotReceive().Remove(Arg.Any<ExpenseType>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "DeleteExpenseTypeHandler elimina físicamente si no tiene compras asociadas")]
    public async Task Handle_DeleteExpenseType_NotUsed_Removes()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var customType = ExpenseType.Create(
            id,
            tenantId,
            "CUSTOM2",
            "Sin uso",
            "01",
            affectsInventory: false,
            isSystem: false,
            suggestedRetentionCode: "312",
            retentionPercentage: 2.00m).Value!;

        _expenseTypes.GetTrackedByIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(customType);
        var purchases = Substitute.For<IPurchaseRepository>();
        purchases.ExistsByExpenseTypeIdAsync(tenantId, id, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeHandler(_expenseTypes, purchases, _unitOfWork);
        var command = new EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType.DeleteExpenseTypeCommand(tenantId, id, Guid.NewGuid());

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        _expenseTypes.Received(1).Remove(customType);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
