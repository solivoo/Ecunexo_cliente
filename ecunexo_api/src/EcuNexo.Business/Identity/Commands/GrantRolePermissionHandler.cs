using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Business.Tenancy.Authorization;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class GrantRolePermissionHandler : ICommandHandler<GrantRolePermissionCommand, GrantRolePermissionResponse>
{
    private readonly IValidator<GrantRolePermissionCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IRoleRepository _roles;
    private readonly IPermissionRepository _permissions;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly IUnitOfWork _unitOfWork;

    public GrantRolePermissionHandler(
        IValidator<GrantRolePermissionCommand> validator,
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

    public async Task<Result<GrantRolePermissionResponse>> Handle(GrantRolePermissionCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<GrantRolePermissionResponse>(
                new Error("role_permission.grant.validation", message, ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<GrantRolePermissionResponse>(
                new Error("role_permission.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        if (!await _roles.ExistsActiveByIdAsync(command.TenantId, command.RoleId, ct).ConfigureAwait(false))
        {
            return Result.Failure<GrantRolePermissionResponse>(
                new Error("role_permission.role.not_found", "El rol no existe o no pertenece al tenant.", ErrorType.NotFound));
        }

        var permission = await _permissions.GetByIdAsync(command.PermissionId, ct).ConfigureAwait(false);
        if (permission is null || permission.Status != PermissionStatus.Active)
        {
            return Result.Failure<GrantRolePermissionResponse>(
                new Error("role_permission.permission.not_found", "El permiso no existe o no está activo.", ErrorType.NotFound));
        }

        if (!ModulePermissionFilter.IsPermittedForModules(
                permission.Code,
                tenant.EnabledModuleCodes,
                tenant.ModuleEntitlements))
        {
            return Result.Failure<GrantRolePermissionResponse>(
                new Error(
                    "role_permission.module.not_entitled",
                    $"El permiso «{permission.Code}» pertenece a un módulo no contratado.",
                    ErrorType.Forbidden));
        }

        if (await _rolePermissions.LinkExistsAsync(command.RoleId, command.PermissionId, ct).ConfigureAwait(false))
        {
            return Result.Failure<GrantRolePermissionResponse>(
                new Error(
                    "role_permission.grant.duplicate",
                    "El rol ya incluye este permiso.",
                    ErrorType.Conflict));
        }

        var link = RolePermission.Link(command.RoleId, command.PermissionId);
        if (link.IsFailure)
        {
            return Result.Failure<GrantRolePermissionResponse>(link.Error!);
        }

        await _rolePermissions.AddAsync(link.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(
            new GrantRolePermissionResponse(command.TenantId, command.RoleId, command.PermissionId));
    }
}
