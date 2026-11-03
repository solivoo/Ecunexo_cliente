using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Tenancy;

public sealed class LicenseComplianceServiceTests
{
    private readonly ILicenseOnlineValidator _validator = Substitute.For<ILicenseOnlineValidator>();
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact(DisplayName = "El login sincroniza entitlements aunque la validación no esté vencida")]
    public async Task EnsureCompliantAsync_SyncsEntitlementsOnLogin()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        _validator.IsConfigured.Returns(true);
        _tenants.ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>())
            .Returns([]);
        _validator.GetEntitlementsAsync(account.GrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteEntitlements(
                account.GrantId,
                2,
                [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Ecommerce],
                null,
                DateTimeOffset.UtcNow)));

        var result = await Sut().EnsureCompliantAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        account.LicenseEntitlementsVersion.Should().Be(2);
        account.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Ecommerce);
        account.LastEntitlementsSyncAtUtc.Should().NotBeNull();
        await _validator.DidNotReceive()
            .ValidateGrantAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "Un fallo del endpoint de entitlements no bloquea el login")]
    public async Task EnsureCompliantAsync_EntitlementsFailure_DoesNotBlockLogin()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        _validator.IsConfigured.Returns(true);
        _validator.GetEntitlementsAsync(account.GrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Failure<LicenseRemoteEntitlements>(
                new Error("license.online.network", "Sin conexión.", ErrorType.Unexpected)));

        var result = await Sut().EnsureCompliantAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        account.LicenseEntitlementsVersion.Should().Be(1);
    }

    [Fact(DisplayName = "El sync de entitlements respeta el throttle entre logins")]
    public async Task EnsureCompliantAsync_SyncIsThrottled()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        account.RecordEntitlementsSync(DateTimeOffset.UtcNow);
        _validator.IsConfigured.Returns(true);

        var result = await Sut().EnsureCompliantAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _validator.DidNotReceive()
            .GetEntitlementsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "El sync aplica el override por empresa y reporta las empresas a la plataforma")]
    public async Task EnsureCompliantAsync_AppliesTenantOverride()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        _validator.IsConfigured.Returns(true);

        var overridden = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Override",
            new ServicePlan("Medium", 10, 2)).Value!;
        var inherited = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Base",
            new ServicePlan("Medium", 10, 2)).Value!;

        _tenants.ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>())
            .Returns([overridden, inherited]);

        _validator.GetEntitlementsAsync(account.GrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteEntitlements(
                account.GrantId,
                2,
                [TenantModuleCodes.Identity, TenantModuleCodes.Catalog],
                null,
                DateTimeOffset.UtcNow,
                [
                    new LicenseRemoteTenantOverride(
                        overridden.Id,
                        "Empresa Override",
                        [TenantModuleCodes.Identity],
                        null,
                        1),
                ])));

        var result = await Sut().EnsureCompliantAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        await _validator.Received(1).ReportTenantsAsync(
            account.GrantId,
            Arg.Is<IReadOnlyList<LicenseTenantRef>>(list =>
                list.Count == 2 && list.Any(t => t.TenantId == overridden.Id)),
            Arg.Any<CancellationToken>());
        overridden.EnabledModuleCodes.Should().Equal(TenantModuleCodes.Identity);
        inherited.EnabledModuleCodes.Should().Contain(TenantModuleCodes.Catalog);
    }

    [Fact(DisplayName = "SyncLicenseOnlineAsync migra automáticamente al grant sucesor activo")]
    public async Task SyncLicenseOnlineAsync_MigratesToSuccessorGrant()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        var oldGrantId = account.GrantId;
        var successorGrantId = Guid.CreateVersion7();
        var newExpires = DateTimeOffset.UtcNow.AddYears(2);

        _validator.IsConfigured.Returns(true);
        _tenants.ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>())
            .Returns([]);
        _validator.ValidateGrantAsync(oldGrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteStatus(
                oldGrantId,
                IsAllowed: true,
                Status: "Revoked",
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddMonths(1),
                SuccessorGrantId: successorGrantId,
                SuccessorStatus: "Active",
                SuccessorExpiresAtUtc: newExpires,
                SuccessorPlanCode: "profesional",
                SuccessorPlanLabel: "Nex Profesional",
                SuccessorMaxTenants: 5,
                SuccessorMaxUsers: 25,
                SuccessorMaxWarehouses: 5,
                SuccessorOnlineValidationIntervalDays: 15,
                SuccessorEnabledModuleCodes: [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Warehousing])));

        _validator.GetEntitlementsAsync(successorGrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteEntitlements(
                successorGrantId,
                1,
                [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Warehousing],
                null,
                DateTimeOffset.UtcNow)));

        var result = await Sut().SyncLicenseOnlineAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        account.GrantId.Should().Be(successorGrantId);
        account.ServicePlan.Name.Should().Be("Nex Profesional");
        account.ServicePlan.MaxUsers.Should().Be(25);
        account.ServicePlan.MaxWarehouses.Should().Be(5);
        account.SubscriptionMaxTenants.Should().Be(5);
        account.LicenseExpiresAtUtc.Should().Be(newExpires);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "SyncLicenseOnlineAsync a plan mínimo sin bodega fija MaxWarehouses en 0 y sincroniza permisos una sola vez")]
    public async Task SyncLicenseOnlineAsync_MinimalPlanWithoutWarehousing_SetsZeroWarehousesAndSyncsOnce()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        var oldGrantId = account.GrantId;
        var successorGrantId = Guid.CreateVersion7();
        var newExpires = DateTimeOffset.UtcNow.AddYears(1);
        var company = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Emprendedor",
            new ServicePlan("Nex Emprendedor", 5, 1),
            enabledModuleCodes: [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Warehousing, TenantModuleCodes.Inventory, TenantModuleCodes.Invoicing]).Value!;

        _validator.IsConfigured.Returns(true);
        _tenants.ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>())
            .Returns([company]);
        _validator.ValidateGrantAsync(oldGrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteStatus(
                oldGrantId,
                IsAllowed: true,
                Status: "Revoked",
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddMonths(1),
                SuccessorGrantId: successorGrantId,
                SuccessorStatus: "Active",
                SuccessorExpiresAtUtc: newExpires,
                SuccessorPlanCode: "nex-basico",
                SuccessorPlanLabel: "Nex Básico",
                SuccessorMaxTenants: 1,
                SuccessorMaxUsers: 3,
                SuccessorMaxWarehouses: 0,
                SuccessorOnlineValidationIntervalDays: 30,
                SuccessorEnabledModuleCodes: [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Invoicing])));

        _validator.GetEntitlementsAsync(successorGrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteEntitlements(
                successorGrantId,
                1,
                [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Invoicing],
                null,
                DateTimeOffset.UtcNow)));

        var result = await Sut().SyncLicenseOnlineAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        account.GrantId.Should().Be(successorGrantId);
        account.ServicePlan.Name.Should().Be("Nex Básico");
        account.ServicePlan.MaxWarehouses.Should().Be(0);
        company.ServicePlan.Name.Should().Be("Nex Básico");
        company.ServicePlan.MaxWarehouses.Should().Be(0);
        company.ResolveMaxWarehouses().Should().Be(0);
        ReferenceEquals(account.ServicePlan, company.ServicePlan).Should().BeFalse();
        await _tenants.Received(1).ListBySubscriptionGroupIdForUpdateAsync(
            account.SubscriptionGroupId,
            Arg.Any<CancellationToken>());
    }

    [Fact(DisplayName = "SyncLicenseOnlineAsync aplica metadatos de /status a empresas incluso si /entitlements falla")]
    public async Task SyncLicenseOnlineAsync_WhenEntitlementsEndpointFails_FallsBackToStatusMetadataAndSyncsCompanies()
    {
        var account = CreateAccount(lastValidationAtUtc: DateTimeOffset.UtcNow);
        var company = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Emprendedor",
            new ServicePlan("Nex Emprendedor", 5, 1),
            enabledModuleCodes: [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Warehousing, TenantModuleCodes.Invoicing]).Value!;

        _validator.IsConfigured.Returns(true);
        _tenants.ListBySubscriptionGroupIdForUpdateAsync(account.SubscriptionGroupId, Arg.Any<CancellationToken>())
            .Returns([company]);
        _validator.ValidateGrantAsync(account.GrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Success(new LicenseRemoteStatus(
                account.GrantId,
                IsAllowed: true,
                Status: "Exhausted",
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddYears(1),
                EntitlementsVersion: 2,
                EnabledModuleCodes: [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Invoicing],
                MaxTenants: 1,
                MaxUsers: 3,
                MaxWarehouses: 0,
                PlanCode: "nex-basico",
                PlanLabel: "Nex Básico",
                OnlineValidationIntervalDays: 30)));

        _validator.GetEntitlementsAsync(account.GrantId, Arg.Any<CancellationToken>())
            .Returns(Result.Failure<LicenseRemoteEntitlements>(
                new Error("license.online.unavailable", "No se pudieron consultar los módulos de la licencia.", ErrorType.Unexpected)));

        var result = await Sut().SyncLicenseOnlineAsync(account, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        account.ServicePlan.Name.Should().Be("Nex Básico");
        account.ServicePlan.MaxWarehouses.Should().Be(0);
        account.LicenseEntitlementsVersion.Should().Be(2);
        company.ServicePlan.Name.Should().Be("Nex Básico");
        company.ServicePlan.MaxWarehouses.Should().Be(0);
        company.EnabledModuleCodes.Should().NotContain(TenantModuleCodes.Warehousing);
        ReferenceEquals(account.ServicePlan, company.ServicePlan).Should().BeFalse();
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private LicenseComplianceService Sut() =>
        new(_validator, _tenants, _unitOfWork, NullLogger<LicenseComplianceService>.Instance);

    private static SubscriptionAccount CreateAccount(DateTimeOffset lastValidationAtUtc)
    {
        var created = SubscriptionAccount.Create(
            Guid.CreateVersion7(),
            Guid.CreateVersion7(),
            new Email("titular@empresa.ec"),
            "Titular",
            "hash-seguro",
            new ServicePlan("Medium", 10, 2),
            3,
            [TenantModuleCodes.Identity, TenantModuleCodes.Catalog],
            null,
            DateTimeOffset.UtcNow.AddYears(1),
            30,
            lastValidationAtUtc);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }
}
