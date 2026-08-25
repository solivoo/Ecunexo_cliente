using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class ReplaceRolePermissionsHandler
    : ICommandHandler<ReplaceRolePermissionsCommand, ReplaceRolePermissionsResponse>
{
    private readonly IValidator<ReplaceRolePermissionsCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IRoleRepository _roles;
    private readonly IPermissionRepository _permissions;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly IUnitOfWork _unitOfWork;

    public ReplaceRolePermissionsHandler(
        IValidator<ReplaceRolePermissionsCommand> validator,
        ITenantRepository tenants,
        IRoleRepository roles,
        IPermissionRepository permissions,
        IRolePermissionRepository rolePermissions,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _roles = roles;
        _permissions = permissions;
        _rolePermissions = rolePermissions;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ReplaceRolePermissionsResponse>> Handle(
        ReplaceRolePermissionsCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<ReplaceRolePermissionsResponse>(
                new Error("role_permission.replace.validation", message, ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<ReplaceRolePermissionsResponse>(
                new Error("role_permission.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        if (!await _roles.ExistsActiveByIdAsync(command.TenantId, command.RoleId, ct).ConfigureAwait(false))
        {
            return Result.Failure<ReplaceRolePermissionsResponse>(
                new Error(
                    "role_permission.role.not_found",
                    "El rol no existe o no pertenece al tenant.",
                    ErrorType.NotFound));
        }

        var desired = command.PermissionIds.Distinct().ToList();
        var catalog = await _permissions.ListNonDeletedOrderedByCodeAsync(ct).ConfigureAwait(false);
        var byId = catalog
            .Where(p => p.Status == PermissionStatus.Active)
            .ToDictionary(p => p.Id);

        foreach (var permissionId in desired)
        {
            if (!byId.TryGetValue(permissionId, out var permission))
            {
                return Result.Failure<ReplaceRolePermissionsResponse>(
                    new Error(
                        "role_permission.permission.not_found",
                        "Uno o más permisos no existen o no están activos.",
                        ErrorType.NotFound));
            }

            if (!ModulePermissionFilter.IsPermittedForModules(
                    permission.Code,
                    tenant.EnabledModuleCodes,
                    tenant.ModuleEntitlements))
            {
                return Result.Failure<ReplaceRolePermissionsResponse>(
                    new Error(
                        "role_permission.module.not_entitled",
                        $"El permiso «{permission.Code}» pertenece a un módulo no contratado.",
                        ErrorType.Forbidden));
            }
        }

        var current = await _rolePermissions
            .ListPermissionIdsByRoleAsync(command.TenantId, command.RoleId, ct)
            .ConfigureAwait(false);
        var currentSet = current.ToHashSet();
        var desiredSet = desired.ToHashSet();

        var toGrant = desired.Where(id => !currentSet.Contains(id)).ToList();
        var toRevoke = current.Where(id => !desiredSet.Contains(id)).ToList();

        foreach (var permissionId in toRevoke)
        {
            await _rolePermissions
                .RemoveAsync(command.TenantId, command.RoleId, permissionId, ct)
                .ConfigureAwait(false);
        }

        foreach (var permissionId in toGrant)
        {
            var link = RolePermission.Link(command.RoleId, permissionId);
            if (link.IsFailure)
            {
                return Result.Failure<ReplaceRolePermissionsResponse>(link.Error!);
            }

            await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(
            new ReplaceRolePermissionsResponse(
                command.TenantId,
                command.RoleId,
                toGrant.Count,
                toRevoke.Count,
                desired));
    }
}
