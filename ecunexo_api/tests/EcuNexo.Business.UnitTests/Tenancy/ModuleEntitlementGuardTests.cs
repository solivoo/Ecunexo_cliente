using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Tenancy;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Tenancy;

public sealed class ModuleEntitlementGuardTests
{
    private readonly ITenantRepository _tenants = Substitute.For<ITenantRepository>();

    [Fact(DisplayName = "Una opción de plan en 0 bloquea el permiso (feature.not_entitled)")]
    public async Task RequireModuleForPermissionAsync_FeatureFlagOff_Blocks()
    {
        var tenant = CreateTenant(flagValue: 0);
        _tenants.GetByIdAsync(tenant.Id, Arg.Any<CancellationToken>()).Returns(tenant);

        var result = await Sut()
            .RequireModuleForPermissionAsync(tenant.Id, "contabilidad.balances.read", CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("feature.not_entitled");
    }

    [Fact(DisplayName = "Una opción de plan en 1 permite el permiso")]
    public async Task RequireModuleForPermissionAsync_FeatureFlagOn_Allows()
    {
        var tenant = CreateTenant(flagValue: 1);
        _tenants.GetByIdAsync(tenant.Id, Arg.Any<CancellationToken>()).Returns(tenant);

        var result = await Sut()
            .RequireModuleForPermissionAsync(tenant.Id, "contabilidad.balances.read", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact(DisplayName = "Sin entitlements (legacy) la opción no bloquea")]
    public async Task RequireModuleForPermissionAsync_LegacyWithoutEntitlements_Allows()
    {
        var tenant = Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Demo",
            new ServicePlan("Medium", 10, 2)).Value!;
        _tenants.GetByIdAsync(tenant.Id, Arg.Any<CancellationToken>()).Returns(tenant);

        var result = await Sut()
            .RequireModuleForPermissionAsync(tenant.Id, "contabilidad.balances.read", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    private ModuleEntitlementGuard Sut() => new(_tenants);

    private static Tenant CreateTenant(int flagValue) =>
        Tenant.Create(
            Guid.CreateVersion7(),
            "Empresa Demo",
            new ServicePlan("Medium", 10, 2),
            moduleEntitlements:
            [
                ModuleEntitlement.FromTier(TenantModuleCodes.Identity, ModuleTier.Small),
                ModuleEntitlement.FromTierWithOverrides(
                    TenantModuleCodes.Accounting,
                    ModuleTier.Small,
                    new Dictionary<string, int>
                    {
                        [ModuleTierCatalog.LimitAllowFinancialStatementsExport] = flagValue,
                    }),
            ]).Value!;
}
