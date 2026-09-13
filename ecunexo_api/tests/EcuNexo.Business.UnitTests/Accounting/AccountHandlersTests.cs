using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Commands.CreateAccount;
using EcuNexo.Business.Accounting.Commands.DeleteAccount;
using EcuNexo.Business.Accounting.Commands.SeedStandardEcuadorPlan;
using EcuNexo.Business.Accounting.Queries.ListAccounts;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Accounting;

public sealed class AccountHandlersTests
{
    private readonly IAccountRepository _accounts = Substitute.For<IAccountRepository>();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "SeedStandardEcuadorPlanHandler siembra catálogo oficial y enlaza cuentas jerárquicamente")]
    public async Task SeedStandardEcuadorPlanHandler_WhenEmpty_SeedsCatalog()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _accounts.ListAsync(tenantId, null, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<Account>());

        _idGenerator.NewId().Returns(_ => Guid.NewGuid());

        var handler = new SeedStandardEcuadorPlanHandler(_accounts, _idGenerator, _unitOfWork);
        var command = new SeedStandardEcuadorPlanCommand(tenantId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.True(result.Value > 30);
        await _accounts.Received(1).AddRangeAsync(Arg.Any<IEnumerable<Account>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateAccountHandler crea cuenta con éxito cuando no hay código duplicado")]
    public async Task CreateAccountHandler_UniqueCode_CreatesAccount()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        _accounts.ExistsByCodeAsync(tenantId, "1.1.01.99", null, Arg.Any<CancellationToken>())
            .Returns(false);
        _idGenerator.NewId().Returns(accountId);

        var handler = new CreateAccountHandler(_accounts, _idGenerator, _unitOfWork);
        var command = new CreateAccountCommand(tenantId, "1.1.01.99", "Caja Moneda Extranjera");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(accountId, result.Value!.Id);
        Assert.Equal("1.1.01.99", result.Value!.Code);
        await _accounts.Received(1).AddAsync(Arg.Any<Account>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "CreateAccountHandler retorna error de conflicto cuando el código ya existe")]
    public async Task CreateAccountHandler_DuplicateCode_ReturnsConflict()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        _accounts.ExistsByCodeAsync(tenantId, "1.1.01.01", null, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new CreateAccountHandler(_accounts, _idGenerator, _unitOfWork);
        var command = new CreateAccountCommand(tenantId, "1.1.01.01", "Caja General Duplicada");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("accounting.account.code_duplicate", result.Error!.Code);
    }

    [Fact(DisplayName = "ListAccountsHandler devuelve listado transformado a DTO")]
    public async Task ListAccountsHandler_ReturnsMappedDtos()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var account = Account.Create(Guid.NewGuid(), tenantId, "1.1", "Activo Corriente").Value!;
        _accounts.ListAsync(tenantId, AccountType.Asset, null, null, null, Arg.Any<CancellationToken>())
            .Returns(new List<Account> { account });

        var handler = new ListAccountsHandler(_accounts);
        var query = new ListAccountsQuery(tenantId, AccountType.Asset);

        // Act
        var result = await handler.Handle(query, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal("1.1", result.Value![0].Code);
    }

    [Fact(DisplayName = "DeleteAccountHandler marca como eliminada la cuenta personalizada")]
    public async Task DeleteAccountHandler_CustomAccount_DeletesSuccessfully()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var accountId = Guid.NewGuid();
        var account = Account.Create(accountId, tenantId, "5.2.03.99", "Otro Gasto Personalizado", isSystem: false).Value!;
        _accounts.GetTrackedByIdAsync(tenantId, accountId, Arg.Any<CancellationToken>())
            .Returns(account);

        var handler = new DeleteAccountHandler(_accounts, _unitOfWork);
        var command = new DeleteAccountCommand(tenantId, accountId);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(account.DeletedAt);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
