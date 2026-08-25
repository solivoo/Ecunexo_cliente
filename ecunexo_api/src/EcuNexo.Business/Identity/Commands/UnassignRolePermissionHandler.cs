using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UnassignRolePermissionHandler
    : ICommandHandler<UnassignRolePermissionCommand, UnassignRolePermissionResponse>
{
    private readonly IValidator<UnassignRolePermissionCommand> _validator;
    private readonly IRoleRepository _roles;
    private readonly IRolePermissionRepository _rolePermissions;
    private readonly IUnitOfWork _unitOfWork;

    public UnassignRolePermissionHandler(
        IValidator<UnassignRolePermissionCommand> validator,
        IRoleRepository roles,
        IRolePermissionRepository rolePermissions,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _roles = roles;
        _rolePermissions = rolePermissions;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UnassignRolePermissionResponse>> Handle(
        UnassignRolePermissionCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UnassignRolePermissionResponse>(
                new Error("role_permission.unassign.validation", message, ErrorType.Validation));
        }

        if (!await _roles.ExistsActiveByIdAsync(command.TenantId, command.RoleId, ct).ConfigureAwait(false))
        {
            return Result.Failure<UnassignRolePermissionResponse>(
                new Error(
                    "role_permission.role.not_found",
                    "El rol no existe o no pertenece al tenant.",
                    ErrorType.NotFound));
        }

        var removed = await _rolePermissions
            .RemoveAsync(command.TenantId, command.RoleId, command.PermissionId, ct)
            .ConfigureAwait(false);
        if (!removed)
        {
            return Result.Failure<UnassignRolePermissionResponse>(
                new Error(
                    "role_permission.link.not_found",
                    "El rol no tiene ese permiso asignado.",
                    ErrorType.NotFound));
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new UnassignRolePermissionResponse(command.TenantId, command.RoleId, command.PermissionId));
    }
}
