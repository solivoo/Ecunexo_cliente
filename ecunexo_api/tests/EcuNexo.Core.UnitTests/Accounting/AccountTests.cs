using EcuNexo.Core.Accounting;

namespace EcuNexo.Core.UnitTests.Accounting;

public class AccountTests
{
    [Fact]
    public void Create_WithValidData_ShouldSucceed()
    {
        // Arrange
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        // Act
        var result = Account.Create(
            id,
            tenantId,
            "1.1.01.01",
            "Caja General",
            description: "Fondo operativo");

        // Assert
        Assert.True(result.IsSuccess);
        var account = result.Value!;
        Assert.Equal(id, account.Id);
        Assert.Equal(tenantId, account.TenantId);
        Assert.Equal("1.1.01.01", account.Code);
        Assert.Equal("Caja General", account.Name);
        Assert.Equal(AccountType.Asset, account.AccountType);
        Assert.Equal(AccountNature.Debit, account.Nature);
        Assert.Equal(4, account.Level);
        Assert.Equal("1.1.01", account.ParentCode);
        Assert.True(account.AllowsMovement);
        Assert.True(account.IsActive);
        Assert.False(account.IsSystem);
    }

    [Theory]
    [InlineData("1", AccountType.Asset, AccountNature.Debit)]
    [InlineData("2", AccountType.Liability, AccountNature.Credit)]
    [InlineData("3", AccountType.Equity, AccountNature.Credit)]
    [InlineData("4", AccountType.Revenue, AccountNature.Credit)]
    [InlineData("5", AccountType.Expense, AccountNature.Debit)]
    public void Create_ShouldInferTypeAndNatureFromRootDigit(string rootCode, AccountType expectedType, AccountNature expectedNature)
    {
        var result = Account.Create(Guid.NewGuid(), Guid.NewGuid(), rootCode, "Cuenta Raíz");

        Assert.True(result.IsSuccess);
        Assert.Equal(expectedType, result.Value!.AccountType);
        Assert.Equal(expectedNature, result.Value!.Nature);
        Assert.Equal(1, result.Value!.Level);
        Assert.Null(result.Value!.ParentCode);
    }

    [Fact]
    public void Create_WithEmptyCodeOrName_ShouldFail()
    {
        var id = Guid.NewGuid();
        var tenantId = Guid.NewGuid();

        var emptyCode = Account.Create(id, tenantId, "", "Nombre");
        Assert.True(emptyCode.IsFailure);
        Assert.Equal("accounting.account.code_empty", emptyCode.Error!.Code);

        var emptyName = Account.Create(id, tenantId, "1.1", "");
        Assert.True(emptyName.IsFailure);
        Assert.Equal("accounting.account.name_empty", emptyName.Error!.Code);
    }

    [Fact]
    public void Update_ShouldModifyPropertiesSuccessfully()
    {
        var account = Account.Create(Guid.NewGuid(), Guid.NewGuid(), "1.1.01.01", "Caja Anterior").Value!;

        var updateResult = account.Update("Caja Central Principal", "Nueva descripción", false, true, AccountNature.Debit);

        Assert.True(updateResult.IsSuccess);
        Assert.Equal("Caja Central Principal", account.Name);
        Assert.Equal("Nueva descripción", account.Description);
        Assert.False(account.AllowsMovement);
        Assert.NotNull(account.UpdatedAt);
    }

    [Fact]
    public void MarkAsDeleted_WhenSystemAccount_ShouldFail()
    {
        var account = Account.Create(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "1.1",
            "Activo Corriente",
            isSystem: true).Value!;

        var result = account.MarkAsDeleted();

        Assert.True(result.IsFailure);
        Assert.Equal("accounting.account.system_cannot_delete", result.Error!.Code);
        Assert.Null(account.DeletedAt);
    }

    [Fact]
    public void StandardEcuadorCatalog_ShouldContainCoreAccounts()
    {
        var catalog = StandardEcuadorChartOfAccounts.DefaultCatalog;

        Assert.NotEmpty(catalog);
        Assert.Contains(catalog, a => a.Code == "1.1.01.01" && a.Name.Contains("Caja"));
        Assert.Contains(catalog, a => a.Code == "2.1.01.01" && a.Name.Contains("Proveedores Locales"));
        Assert.Contains(catalog, a => a.Code == "1.1.03.01" && a.Name.Contains("Mercaderías"));
        Assert.Contains(catalog, a => a.Code == "5.2.03.01" && a.Name.Contains("Publicidad"));
    }
}
