using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.ApiKeys;
using EcuNexo.Business.Identity.Authorization;
using EcuNexo.Business.Identity.PolicyEvaluation;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Identity;

public sealed class TenantApiKeyAuthorizationTests
{
    [Fact]
    public void Crypto_GenerateAndVerify_ShouldMatchValidAndRejectTampered()
    {
        var (plainTextKey, prefix, hash) = TenantApiKeyCrypto.GenerateKey();

        Assert.StartsWith("ecx_live_", plainTextKey, StringComparison.Ordinal);
        Assert.True(TenantApiKeyCrypto.TryExtractPrefix(plainTextKey, out var extractedPrefix, out var trimmed));
        Assert.Equal(prefix, extractedPrefix);
        Assert.True(TenantApiKeyCrypto.VerifyFixedTime(trimmed, hash));
        Assert.False(TenantApiKeyCrypto.VerifyFixedTime(trimmed + "0", hash));
    }

    [Fact]
    public async Task RequireAsync_WhenApiKeyMatchesTenantModuleAndScope_ShouldSucceed()
    {
        var tenantId = Guid.NewGuid();
        var caller = Substitute.For<ICallerContext>();
        caller.IsApiKeyCaller.Returns(true);
        caller.ExplicitTenantId.Returns(tenantId);
        caller.ApiKeyScopes.Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "catalog.item.read" });

        var tenantContext = Substitute.For<ITenantContext>();
        tenantContext.CurrentTenantId.Returns(tenantId);

        var modules = Substitute.For<IModuleEntitlementGuard>();
        modules.RequireModuleForPermissionAsync(tenantId, "catalog.item.read", Arg.Any<CancellationToken>())
            .Returns(Result.Success());

        var guard = new PermissionAccessGuard(
            caller,
            tenantContext,
            modules,
            Substitute.For<IUserRepository>(),
            Substitute.For<IPermissionRepository>(),
            Substitute.For<IUserPermissionQuery>(),
            Substitute.For<IPolicyRepository>(),
            Substitute.For<IPolicyEvaluator>());

        var result = await guard.RequireAsync(
            "catalog.item.read",
            new PolicyEvaluationContext(null, null, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task RequireAsync_WhenApiKeyTargetsDifferentTenant_ShouldFailWithTenantMismatch()
    {
        var apiKeyTenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();

        var caller = Substitute.For<ICallerContext>();
        caller.IsApiKeyCaller.Returns(true);
        caller.ExplicitTenantId.Returns(apiKeyTenantId);
        caller.ApiKeyScopes.Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "catalog.item.read" });

        var tenantContext = Substitute.For<ITenantContext>();
        tenantContext.CurrentTenantId.Returns(otherTenantId);

        var guard = new PermissionAccessGuard(
            caller,
            tenantContext,
            Substitute.For<IModuleEntitlementGuard>(),
            Substitute.For<IUserRepository>(),
            Substitute.For<IPermissionRepository>(),
            Substitute.For<IUserPermissionQuery>(),
            Substitute.For<IPolicyRepository>(),
            Substitute.For<IPolicyEvaluator>());

        var result = await guard.RequireAsync(
            "catalog.item.read",
            new PolicyEvaluationContext(null, null, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("auth.tenant.mismatch", result.Error?.Code);
    }

    [Fact]
    public async Task RequireAsync_WhenApiKeyLacksScope_ShouldFailWithScopeDenied()
    {
        var tenantId = Guid.NewGuid();
        var caller = Substitute.For<ICallerContext>();
        caller.IsApiKeyCaller.Returns(true);
        caller.ExplicitTenantId.Returns(tenantId);
        caller.ApiKeyScopes.Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "catalog.item.read" });

        var tenantContext = Substitute.For<ITenantContext>();
        tenantContext.CurrentTenantId.Returns(tenantId);

        var modules = Substitute.For<IModuleEntitlementGuard>();
        modules.RequireModuleForPermissionAsync(tenantId, "catalog.item.create", Arg.Any<CancellationToken>())
            .Returns(Result.Success());

        var guard = new PermissionAccessGuard(
            caller,
            tenantContext,
            modules,
            Substitute.For<IUserRepository>(),
            Substitute.For<IPermissionRepository>(),
            Substitute.For<IUserPermissionQuery>(),
            Substitute.For<IPolicyRepository>(),
            Substitute.For<IPolicyEvaluator>());

        var result = await guard.RequireAsync(
            "catalog.item.create",
            new PolicyEvaluationContext(null, null, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("auth.api_key.scope_denied", result.Error?.Code);
    }

    [Fact]
    public async Task RequireAsync_WhenModuleNotEntitled_ShouldFailWithModuleNotEntitled()
    {
        var tenantId = Guid.NewGuid();
        var caller = Substitute.For<ICallerContext>();
        caller.IsApiKeyCaller.Returns(true);
        caller.ExplicitTenantId.Returns(tenantId);
        caller.ApiKeyScopes.Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "inventory.stock.read" });

        var tenantContext = Substitute.For<ITenantContext>();
        tenantContext.CurrentTenantId.Returns(tenantId);

        var modules = Substitute.For<IModuleEntitlementGuard>();
        modules.RequireModuleForPermissionAsync(tenantId, "inventory.stock.read", Arg.Any<CancellationToken>())
            .Returns(Result.Failure(new Error("module.not_entitled", "No contratado", ErrorType.Forbidden)));

        var guard = new PermissionAccessGuard(
            caller,
            tenantContext,
            modules,
            Substitute.For<IUserRepository>(),
            Substitute.For<IPermissionRepository>(),
            Substitute.For<IUserPermissionQuery>(),
            Substitute.For<IPolicyRepository>(),
            Substitute.For<IPolicyEvaluator>());

        var result = await guard.RequireAsync(
            "inventory.stock.read",
            new PolicyEvaluationContext(null, null, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("module.not_entitled", result.Error?.Code);
    }

    [Fact]
    public async Task RequireAsync_WhenPermissionIsInternalOnly_ShouldRejectApiKey()
    {
        var tenantId = Guid.NewGuid();
        var caller = Substitute.For<ICallerContext>();
        caller.IsApiKeyCaller.Returns(true);
        caller.ExplicitTenantId.Returns(tenantId);
        caller.ApiKeyScopes.Returns(new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "identity.roles.manage" });

        var tenantContext = Substitute.For<ITenantContext>();
        tenantContext.CurrentTenantId.Returns(tenantId);

        var guard = new PermissionAccessGuard(
            caller,
            tenantContext,
            Substitute.For<IModuleEntitlementGuard>(),
            Substitute.For<IUserRepository>(),
            Substitute.For<IPermissionRepository>(),
            Substitute.For<IUserPermissionQuery>(),
            Substitute.For<IPolicyRepository>(),
            Substitute.For<IPolicyEvaluator>());

        var result = await guard.RequireAsync(
            "identity.roles.manage",
            new PolicyEvaluationContext(null, null, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("auth.api_key.permission_not_allowed", result.Error?.Code);
    }
}
