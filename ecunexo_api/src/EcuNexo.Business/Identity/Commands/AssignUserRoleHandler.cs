using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class AssignUserRoleHandler : ICommandHandler<AssignUserRoleCommand, AssignUserRoleResponse>
{
    private readonly IValidator<AssignUserRoleCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IRoleRepository _roles;
    private readonly IUserRoleRepository _userRoles;
    private readonly ICompanyOwnerGuard _companyOwner;
    private readonly IUnitOfWork _unitOfWork;

    public AssignUserRoleHandler(
        IValidator<AssignUserRoleCommand> validator,
        ITenantRepository tenants,
        IUserRepository users,
        IRoleRepository roles,
        IUserRoleRepository userRoles,
        ICompanyOwnerGuard companyOwner,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _users = users;
        _roles = roles;
        _userRoles = userRoles;
        _companyOwner = companyOwner;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AssignUserRoleResponse>> Handle(AssignUserRoleCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<AssignUserRoleResponse>(new Error("user_role.assign.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<AssignUserRoleResponse>(
                new Error("user_role.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        var user = await _users.GetActiveByIdAsync(command.TenantId, command.UserId, ct).ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<AssignUserRoleResponse>(
                new Error("user_role.user.not_found", "El usuario no existe o no pertenece al tenant.", ErrorType.NotFound));
        }

        if (!await _roles.ExistsActiveByIdAsync(command.TenantId, command.RoleId, ct).ConfigureAwait(false))
        {
            return Result.Failure<AssignUserRoleResponse>(
                new Error("user_role.role.not_found", "El rol no existe o no pertenece al tenant.", ErrorType.NotFound));
        }

        if (await _userRoles.AssignmentExistsAsync(command.TenantId, command.UserId, command.RoleId, ct).ConfigureAwait(false))
        {
            return Result.Failure<AssignUserRoleResponse>(
                new Error(
                    "user_role.assign.duplicate",
                    "El usuario ya tiene este rol asignado.",
                    ErrorType.Conflict));
        }

        var ownerCheck = await _companyOwner
            .EnsureCanChangeRolesAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (ownerCheck.IsFailure)
        {
            return Result.Failure<AssignUserRoleResponse>(ownerCheck.Error!);
        }

        var assignment = UserRole.Assign(command.TenantId, command.UserId, command.RoleId);
        if (assignment.IsFailure)
        {
            return Result.Failure<AssignUserRoleResponse>(assignment.Error!);
        }

        await _userRoles.AddAsync(assignment.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(
            new AssignUserRoleResponse(command.TenantId, command.UserId, command.RoleId));
    }
}
