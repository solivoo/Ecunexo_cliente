using EcuNexo.Core.Identity;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.UnitTests.Tenancy;

public sealed class SubscriptionAccountEntitlementsTests
{
    [Fact(DisplayName = "Una versión nueva aplica módulos y entitlements remotos")]
    public void ApplyRemoteEntitlements_NewVersion_UpdatesAccount()
    {
        var account = CreateAccount();
        var utcNow = DateTimeOffset.UtcNow;

        var result = account.ApplyRemoteEntitlements(
            [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Ecommerce],
            [ModuleEntitlement.FromTier(TenantModuleCodes.Catalog, ModuleTier.Big)],
            2,
            utcNow);

        result.IsSuccess.Should().BeTrue();
        account.LicenseEntitlementsVersion.Should().Be(2);
        account.EnabledModuleCodes.Should().BeEquivalentTo(
            [TenantModuleCodes.Identity, TenantModuleCodes.Catalog, TenantModuleCodes.Ecommerce]);
        account.ModuleEntitlements.Should().ContainSingle();
        account.UpdatedAt.Should().Be(utcNow);
    }

    [Fact(DisplayName = "Una versión remota igual o anterior no cambia la cuenta")]
    public void ApplyRemoteEntitlements_StaleVersion_IsNoOp()
    {
        var account = CreateAccount();
        var previousModules = account.EnabledModuleCodes!.ToList();

        var result = account.ApplyRemoteEntitlements([TenantModuleCodes.Identity], null, 1, DateTimeOffset.UtcNow);

        result.IsSuccess.Should().BeTrue();
        account.LicenseEntitlementsVersion.Should().Be(1);
        account.EnabledModuleCodes.Should().BeEquivalentTo(previousModules);
    }

    [Fact(DisplayName = "Un módulo desconocido en el sync es rechazado")]
    public void ApplyRemoteEntitlements_UnknownModule_Fails()
    {
        var account = CreateAccount();

        var result = account.ApplyRemoteEntitlements(["modulo.inventado"], null, 3, DateTimeOffset.UtcNow);

        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("subscription.enabled_modules.unknown");
    }

    [Fact(DisplayName = "Reemplazar la licencia reinicia la versión de entitlements")]
    public void ReplaceLicenseGrant_ResetsEntitlementsVersion()
    {
        var account = CreateAccount();
        account.ApplyRemoteEntitlements([TenantModuleCodes.Identity, TenantModuleCodes.Catalog], null, 5, DateTimeOffset.UtcNow)
            .IsSuccess.Should().BeTrue();

        var result = account.ReplaceLicenseGrant(
            Guid.CreateVersion7(),
            new ServicePlan("Big", 20, 4),
            5,
            [TenantModuleCodes.Identity],
            null,
            DateTimeOffset.UtcNow.AddYears(1),
            30,
            DateTimeOffset.UtcNow);

        result.IsSuccess.Should().BeTrue();
        account.LicenseEntitlementsVersion.Should().Be(1);
    }

    private static SubscriptionAccount CreateAccount()
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
            lastOnlineLicenseValidationAtUtc: null);

        created.IsSuccess.Should().BeTrue(because: created.Error?.Message);
        return created.Value!;
    }
}
