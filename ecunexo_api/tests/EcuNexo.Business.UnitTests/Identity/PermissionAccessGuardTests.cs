using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.Authorization;
using EcuNexo.Business.Identity.PolicyEvaluation;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using NSubstitute;

namespace EcuNexo.Business.UnitTests.Identity;

/// <summary>
/// Prioridad Identity — PermissionAccessGuard: titular, RBAC y denegaciones.
/// </summary>
public sealed class PermissionAccessGuardTests
{
    [Fact(DisplayName = "Sin UserId responde Unauthorized")]
    public async Task RequireAsync_MissingUserId_Unauthorized()
    {
        // Preparar
        var (sut, caller, _, _, _, _, _, _) = CreateSut();
        caller.UserId.Returns((Guid?)null);

        // Actuar
        var result = await sut.RequireAsync(
            "identity.users.read",
            PolicyEvaluationContext.ForSyntaxCheck(),
            CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("auth.user_id.required");
        result.Error.Type.Should().Be(ErrorType.Unauthorized);
    }

    [Fact(DisplayName = "Titular con permiso de suscripción permitido pasa")]
    public async Task RequireAsync_SubscriptionHolderAllowed_Succeeds()
    {
        // Preparar
        var (sut, caller, _, _, _, _, _, _) = CreateSut();
        caller.UserId.Returns(Guid.CreateVersion7());
        caller.IsSubscriptionHolder.Returns(true);

        // Actuar
        var result = await sut.RequireAsync(
            "tenancy.tenants.read",
            PolicyEvaluationContext.ForSyntaxCheck(),
            CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
    }

    [Fact(DisplayName = "Titular con permiso de tenant se deniega")]
    public async Task RequireAsync_SubscriptionHolderDenied_Forbidden()
    {
        // Preparar
        var (sut, caller, _, _, _, _, _, _) = CreateSut();
        caller.UserId.Returns(Guid.CreateVersion7());
        caller.IsSubscriptionHolder.Returns(true);

        // Actuar
        var result = await sut.RequireAsync(
            "identity.users.read",
            PolicyEvaluationContext.ForSyntaxCheck(),
            CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("permission.rbac.denied");
        result.Error.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact(DisplayName = "Usuario tenant con rol que tiene el permiso pasa")]
    public async Task RequireAsync_TenantUserWithPermission_Succeeds()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var userId = Guid.CreateVersion7();
        var permissionId = Guid.CreateVersion7();
        var (sut, caller, tenant, modules, users, permissions, userPermission, policies) = CreateSut();

        caller.UserId.Returns(userId);
        caller.IsSubscriptionHolder.Returns(false);
        tenant.CurrentTenantId.Returns(tenantId);

        var user = User.Create(userId, tenantId, new Email("u@ecunexo.local"), "Usuario", null).Value!;
        users.GetActiveByIdAsync(tenantId, userId, Arg.Any<CancellationToken>()).Returns(user);
        modules.RequireModuleForPermissionAsync(tenantId, "identity.users.read", Arg.Any<CancellationToken>())
            .Returns(Result.Success());
        permissions.GetActiveIdByCodeAsync("identity.users.read", Arg.Any<CancellationToken>())
            .Returns(permissionId);
        userPermission.UserHasPermissionAsync(tenantId, userId, permissionId, Arg.Any<CancellationToken>())
            .Returns(true);
        policies.ListByPermissionIdAsync(permissionId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Policy>());

        // Actuar
        var result = await sut.RequireAsync(
            "identity.users.read",
            new PolicyEvaluationContext(userId, tenantId, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        // Verificar
        result.IsSuccess.Should().BeTrue(because: result.Error?.Message);
    }

    [Fact(DisplayName = "Usuario sin el permiso en roles se deniega")]
    public async Task RequireAsync_TenantUserWithoutPermission_Forbidden()
    {
        // Preparar
        var tenantId = Guid.CreateVersion7();
        var userId = Guid.CreateVersion7();
        var permissionId = Guid.CreateVersion7();
        var (sut, caller, tenant, modules, users, permissions, userPermission, policies) = CreateSut();

        caller.UserId.Returns(userId);
        caller.IsSubscriptionHolder.Returns(false);
        tenant.CurrentTenantId.Returns(tenantId);

        var user = User.Create(userId, tenantId, new Email("u@ecunexo.local"), "Usuario", null).Value!;
        users.GetActiveByIdAsync(tenantId, userId, Arg.Any<CancellationToken>()).Returns(user);
        modules.RequireModuleForPermissionAsync(tenantId, "identity.users.delete", Arg.Any<CancellationToken>())
            .Returns(Result.Success());
        permissions.GetActiveIdByCodeAsync("identity.users.delete", Arg.Any<CancellationToken>())
            .Returns(permissionId);
        userPermission.UserHasPermissionAsync(tenantId, userId, permissionId, Arg.Any<CancellationToken>())
            .Returns(false);
        policies.ListByPermissionIdAsync(permissionId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Policy>());

        // Actuar
        var result = await sut.RequireAsync(
            "identity.users.delete",
            new PolicyEvaluationContext(userId, tenantId, null, DateTimeOffset.UtcNow),
            CancellationToken.None);

        // Verificar
        result.IsFailure.Should().BeTrue();
        result.Error!.Code.Should().Be("permission.rbac.denied");
    }

    private static (
        PermissionAccessGuard Sut,
        ICallerContext Caller,
        ITenantContext Tenant,
        IModuleEntitlementGuard Modules,
        IUserRepository Users,
        IPermissionRepository Permissions,
        IUserPermissionQuery UserPermission,
        IPolicyRepository Policies)
        CreateSut()
    {
        var caller = Substitute.For<ICallerContext>();
        var tenant = Substitute.For<ITenantContext>();
        var modules = Substitute.For<IModuleEntitlementGuard>();
        var users = Substitute.For<IUserRepository>();
        var permissions = Substitute.For<IPermissionRepository>();
        var userPermission = Substitute.For<IUserPermissionQuery>();
        var policies = Substitute.For<IPolicyRepository>();
        var evaluator = Substitute.For<IPolicyEvaluator>();

        var sut = new PermissionAccessGuard(
            caller,
            tenant,
            modules,
            users,
            permissions,
            userPermission,
            policies,
            evaluator);

        return (sut, caller, tenant, modules, users, permissions, userPermission, policies);
    }
}
