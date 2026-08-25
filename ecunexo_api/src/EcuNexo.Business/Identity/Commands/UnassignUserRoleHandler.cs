using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UnassignUserRoleHandler
    : ICommandHandler<UnassignUserRoleCommand, UnassignUserRoleResponse>
{
    private readonly IValidator<UnassignUserRoleCommand> _validator;
    private readonly IUserRepository _users;
    private readonly IUserRoleRepository _userRoles;
    private readonly ICompanyOwnerGuard _companyOwner;
    private readonly IUnitOfWork _unitOfWork;

    public UnassignUserRoleHandler(
        IValidator<UnassignUserRoleCommand> validator,
        IUserRepository users,
        IUserRoleRepository userRoles,
        ICompanyOwnerGuard companyOwner,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _users = users;
        _userRoles = userRoles;
        _companyOwner = companyOwner;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UnassignUserRoleResponse>> Handle(
        UnassignUserRoleCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UnassignUserRoleResponse>(
                new Error("user_role.unassign.validation", message, ErrorType.Validation));
        }

        var user = await _users.GetActiveByIdAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<UnassignUserRoleResponse>(
                new Error(
                    "user_role.user.not_found",
                    "El usuario no existe o no pertenece al tenant.",
                    ErrorType.NotFound));
        }

        var ownerCheck = await _companyOwner
            .EnsureCanChangeRolesAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (ownerCheck.IsFailure)
        {
            return Result.Failure<UnassignUserRoleResponse>(ownerCheck.Error!);
        }

        var removed = await _userRoles
            .RemoveAsync(command.TenantId, command.UserId, command.RoleId, ct)
            .ConfigureAwait(false);
        if (!removed)
        {
            return Result.Failure<UnassignUserRoleResponse>(
                new Error(
                    "user_role.assignment.not_found",
                    "El usuario no tiene ese rol asignado.",
                    ErrorType.NotFound));
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new UnassignUserRoleResponse(command.TenantId, command.UserId, command.RoleId));
    }
}
