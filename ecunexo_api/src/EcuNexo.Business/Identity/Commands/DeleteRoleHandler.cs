using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class DeleteRoleHandler : ICommandHandler<DeleteRoleCommand, DeleteRoleResponse>
{
    private readonly IValidator<DeleteRoleCommand> _validator;
    private readonly IRoleRepository _roles;
    private readonly IUserRoleRepository _userRoles;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteRoleHandler(
        IValidator<DeleteRoleCommand> validator,
        IRoleRepository roles,
        IUserRoleRepository userRoles,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _roles = roles;
        _userRoles = userRoles;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteRoleResponse>> Handle(
        DeleteRoleCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<DeleteRoleResponse>(
                new Error("role.delete.validation", message, ErrorType.Validation));
        }

        var role = await _roles
            .GetActiveByIdForUpdateAsync(command.TenantId, command.RoleId, ct)
            .ConfigureAwait(false);
        if (role is null)
        {
            return Result.Failure<DeleteRoleResponse>(
                new Error("role.not_found", "El rol no existe.", ErrorType.NotFound));
        }

        if (role.IsSystem)
        {
            return Result.Failure<DeleteRoleResponse>(
                new Error("role.system.immutable", "No se puede eliminar un rol del sistema.", ErrorType.Conflict));
        }

        var hasAssignedUsers = await _userRoles
            .HasActiveUsersAssignedAsync(command.TenantId, command.RoleId, ct)
            .ConfigureAwait(false);
        if (hasAssignedUsers)
        {
            return Result.Failure<DeleteRoleResponse>(
                new Error(
                    "role.has_users",
                    "No se puede eliminar el rol porque tiene usuarios asignados. Reasigna a los usuarios a otro rol primero.",
                    ErrorType.Conflict));
        }

        var deletedBy = command.CurrentUserId ?? _caller.UserId;
        var deleted = role.SoftDelete(DateTimeOffset.UtcNow, deletedBy);
        if (deleted.IsFailure)
        {
            return Result.Failure<DeleteRoleResponse>(deleted.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new DeleteRoleResponse(role.Id, role.TenantId));
    }
}
