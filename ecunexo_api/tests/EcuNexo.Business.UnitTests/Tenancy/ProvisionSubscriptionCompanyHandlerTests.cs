using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;
using EcuNexo.Business.Warehousing;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using FluentValidation;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Tenancy;

public sealed class ProvisionSubscriptionCompanyHandlerTests
{
    private static readonly string[] TestModules = ["identity", "facturacion"];
    private static readonly string[] SingleModule = ["identity"];

    private readonly IValidator<ProvisionSubscriptionCompanyCommand> _validator = new ProvisionSubscriptionCompanyValidator();
    private readonly IIdGenerator _idGenerator = Substitute.For<IIdGenerator>();
    private readonly ISubscriptionAccountRepository _accounts = Substitute.For<ISubscriptionAccountRepository>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IDepartmentRepository _departments = Substitute.For<IDepartmentRepository>();
    private readonly IRoleRepository _roles = Substitute.For<IRoleRepository>();
    private readonly IPermissionRepository _permissions = Substitute.For<IPermissionRepository>();
    private readonly IRolePermissionRepository _rolePermissions = Substitute.For<IRolePermissionRepository>();
    private readonly IUserRoleRepository _userRoles = Substitute.For<IUserRoleRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly IWarehouseRepository _warehouses = Substitute.For<IWarehouseRepository>();
    private readonly DefaultWarehouseProvisioner _warehouseProvisioner;

    public ProvisionSubscriptionCompanyHandlerTests()
    {
        _idGenerator.NewId().Returns(_ => Guid.NewGuid());
        _warehouseProvisioner = new DefaultWarehouseProvisioner(_idGenerator, _tenants, _warehouses, _unitOfWork);
        _permissions.ListNonDeletedOrderedByCodeAsync(Arg.Any<CancellationToken>())
            .Returns(new List<Permission>());
    }

    [Fact(DisplayName = "ProvisionSubscriptionCompany hereda contraseña del titular root cuando OwnerPassword no se envía")]
    public async Task Handle_WithoutOwnerPassword_InheritsTitularPasswordHash()
    {
        var accountId = Guid.NewGuid();
        const string titularPasswordHash = "pbkdf2$titular-root-password-hash";
        const string titularEmail = "root@solortrans.ec";
        const string titularName = "Johana Titular";

        var account = SubscriptionAccount.Create(
            accountId,
            Guid.NewGuid(),
            new Email(titularEmail),
            titularName,
            titularPasswordHash,
            new ServicePlan("Local", 3, 1),
            subscriptionMaxTenants: 3,
            enabledModuleCodes: TestModules,
            moduleEntitlements: null,
            licenseExpiresAtUtc: DateTimeOffset.UtcNow.AddYears(1),
            onlineValidationIntervalDays: 30,
            lastOnlineLicenseValidationAtUtc: DateTimeOffset.UtcNow).Value!;

        _accounts.GetByIdAsync(accountId, Arg.Any<CancellationToken>()).Returns(account);
        _tenants.CountBySubscriptionGroupIdAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>()).Returns(0);
        _users.EmailExistsAsync(Arg.Any<Guid>(), Arg.Any<Email>(), Arg.Any<CancellationToken>()).Returns(false);

        User? capturedUser = null;
        await _users.AddAsync(Arg.Do<User>(u => capturedUser = u), Arg.Any<CancellationToken>());

        var handler = new ProvisionSubscriptionCompanyHandler(
            _validator,
            _idGenerator,
            _accounts,
            _tenants,
            _users,
            _departments,
            _roles,
            _permissions,
            _rolePermissions,
            _userRoles,
            _unitOfWork,
            _passwordHasher,
            _warehouseProvisioner);

        var command = new ProvisionSubscriptionCompanyCommand(
            accountId,
            "Solortrans Cía. Ltda.",
            OwnerEmail: null,
            OwnerName: null,
            OwnerPassword: null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedUser);
        Assert.Equal(titularEmail, capturedUser.Email.Value);
        Assert.Equal(titularName, capturedUser.Name);
        Assert.Equal(titularPasswordHash, capturedUser.PasswordHash);
        _passwordHasher.DidNotReceive().Hash(Arg.Any<string>());
    }

    [Fact(DisplayName = "ProvisionSubscriptionCompany usa contraseña personalizada si OwnerPassword se especifica")]
    public async Task Handle_WithOwnerPassword_HashesAndSetsCustomPassword()
    {
        var accountId = Guid.NewGuid();
        const string titularPasswordHash = "pbkdf2$titular-hash";
        const string customPassword = "CustomCompanyPassword123!";
        const string customPasswordHash = "pbkdf2$custom-hash";

        var account = SubscriptionAccount.Create(
            accountId,
            Guid.NewGuid(),
            new Email("titular@empresa.ec"),
            "Titular General",
            titularPasswordHash,
            new ServicePlan("Local", 3, 1),
            subscriptionMaxTenants: 3,
            enabledModuleCodes: SingleModule,
            moduleEntitlements: null,
            licenseExpiresAtUtc: DateTimeOffset.UtcNow.AddYears(1),
            onlineValidationIntervalDays: 30,
            lastOnlineLicenseValidationAtUtc: DateTimeOffset.UtcNow).Value!;

        _accounts.GetByIdAsync(accountId, Arg.Any<CancellationToken>()).Returns(account);
        _tenants.CountBySubscriptionGroupIdAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>()).Returns(0);
        _users.EmailExistsAsync(Arg.Any<Guid>(), Arg.Any<Email>(), Arg.Any<CancellationToken>()).Returns(false);
        _passwordHasher.Hash(customPassword).Returns(customPasswordHash);

        User? capturedUser = null;
        await _users.AddAsync(Arg.Do<User>(u => capturedUser = u), Arg.Any<CancellationToken>());

        var handler = new ProvisionSubscriptionCompanyHandler(
            _validator,
            _idGenerator,
            _accounts,
            _tenants,
            _users,
            _departments,
            _roles,
            _permissions,
            _rolePermissions,
            _userRoles,
            _unitOfWork,
            _passwordHasher,
            _warehouseProvisioner);

        var command = new ProvisionSubscriptionCompanyCommand(
            accountId,
            "Segunda Empresa SAS",
            OwnerEmail: "admin2@empresa.ec",
            OwnerName: "Administrador Dos",
            OwnerPassword: customPassword);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedUser);
        Assert.Equal("admin2@empresa.ec", capturedUser.Email.Value);
        Assert.Equal("Administrador Dos", capturedUser.Name);
        Assert.Equal(customPasswordHash, capturedUser.PasswordHash);
        _passwordHasher.Received(1).Hash(customPassword);
    }
}
