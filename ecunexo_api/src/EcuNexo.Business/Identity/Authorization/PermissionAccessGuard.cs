using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.PolicyEvaluation;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;

using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Identity.Authorization;

public sealed class PermissionAccessGuard : IPermissionAccessGuard
{
    private readonly ICallerContext _caller;
    private readonly ITenantContext _tenant;
    private readonly IModuleEntitlementGuard _modules;
    private readonly IUserRepository _users;
    private readonly IPermissionRepository _permissions;
    private readonly IUserPermissionQuery _userPermission;
    private readonly IPolicyRepository _policies;
    private readonly IPolicyEvaluator _evaluator;

    public PermissionAccessGuard(
        ICallerContext caller,
        ITenantContext tenant,
        IModuleEntitlementGuard modules,
        IUserRepository users,
        IPermissionRepository permissions,
        IUserPermissionQuery userPermission,
        IPolicyRepository policies,
        IPolicyEvaluator evaluator)
    {
        _caller = caller;
        _tenant = tenant;
        _modules = modules;
        _users = users;
        _permissions = permissions;
        _userPermission = userPermission;
        _policies = policies;
        _evaluator = evaluator;
    }

    /// <inheritdoc />
    public async Task<Result> RequireAsync(
        string permissionCode,
        PolicyEvaluationContext evaluationContext,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(permissionCode))
        {
            return Result.Failure(
                new Error(
                    "permission.code.required",
                    "El código de permiso es obligatorio.",
                    ErrorType.Validation));
        }

        if (_caller.UserId is not { } userId)
        {
            return Result.Failure(
                new Error(
                    "auth.user_id.required",
                    "Falta identidad de usuario (p. ej. cabecera X-EcuNexo-User-Id en desarrollo).",
                    ErrorType.Unauthorized));
        }

        var normalizedCode = permissionCode.Trim().ToLowerInvariant();

        if (_caller.IsSubscriptionHolder)
        {
            if (!SubscriptionAccountPermissions.IsAllowed(normalizedCode))
            {
                return Result.Failure(
                    new Error(
                        "permission.rbac.denied",
                        "El titular de licencia no tiene este permiso.",
                        ErrorType.Forbidden));
            }

            return Result.Success();
        }

        var tenantId = _tenant.CurrentTenantId ?? _caller.ExplicitTenantId;
        if (tenantId is null)
        {
            return Result.Failure(
                new Error(
                    "auth.tenant.required",
                    "Se requiere tenant en la ruta o cabecera X-EcuNexo-Tenant-Id.",
                    ErrorType.Validation));
        }

        if (await _users.GetActiveByIdAsync(tenantId.Value, userId, ct).ConfigureAwait(false) is null)
        {
            return Result.Failure(
                new Error(
                    "auth.user.not_found",
                    "El usuario no existe o está inactivo en este tenant.",
                    ErrorType.Forbidden));
        }

        var moduleCheck = await _modules.RequireModuleForPermissionAsync(tenantId.Value, normalizedCode, ct)
            .ConfigureAwait(false);
        if (moduleCheck.IsFailure)
        {
            return moduleCheck;
        }

        if (await _permissions.GetActiveIdByCodeAsync(normalizedCode, ct).ConfigureAwait(false) is not { } permissionId)
        {
            return Result.Failure(
                new Error(
                    "permission.not_found",
                    $"No existe un permiso activo con el código «{normalizedCode}».",
                    ErrorType.Forbidden));
        }

        if (!await _userPermission.UserHasPermissionAsync(tenantId.Value, userId, permissionId, ct)
                .ConfigureAwait(false))
        {
            return Result.Failure(
                new Error(
                    "permission.rbac.denied",
                    "El usuario no tiene este permiso mediante roles.",
                    ErrorType.Forbidden));
        }

        var policyRows = await _policies.ListByPermissionIdAsync(permissionId, ct).ConfigureAwait(false);
        foreach (var policy in policyRows)
        {
            var evalResult = await _evaluator.EvaluateAsync(policy.Condition, evaluationContext, ct)
                .ConfigureAwait(false);
            if (evalResult.IsFailure)
            {
                return Result.Failure(evalResult.Error!);
            }

            if (!evalResult.Value)
            {
                continue;
            }

            if (policy.Effect == PolicyEffect.Deny)
            {
                return Result.Failure(
                    new Error(
                        "policy.deny",
                        "Una política ABAC Deny aplica para este contexto.",
                        ErrorType.Forbidden));
            }
        }

        return Result.Success();
    }
}
