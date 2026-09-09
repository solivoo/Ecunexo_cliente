using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UpdateRoleHandler : ICommandHandler<UpdateRoleCommand, UpdateRoleResponse>
{
    private readonly IValidator<UpdateRoleCommand> _validator;
    private readonly IRoleRepository _roles;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateRoleHandler(
        IValidator<UpdateRoleCommand> validator,
        IRoleRepository roles,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _roles = roles;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateRoleResponse>> Handle(
        UpdateRoleCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateRoleResponse>(
                new Error("role.update.validation", message, ErrorType.Validation));
        }

        var role = await _roles
            .GetActiveByIdForUpdateAsync(command.TenantId, command.RoleId, ct)
            .ConfigureAwait(false);
        if (role is null)
        {
            return Result.Failure<UpdateRoleResponse>(
                new Error("role.not_found", "El rol no existe.", ErrorType.NotFound));
        }

        if (await _roles
            .NameExistsIgnoreCaseAsync(command.TenantId, command.Name, ct, command.RoleId)
            .ConfigureAwait(false))
        {
            return Result.Failure<UpdateRoleResponse>(
                new Error(
                    "role.name.duplicate",
                    "Ya existe un rol con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var updated = role.Update(command.Name, command.Description);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateRoleResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateRoleResponse(role.Id, role.TenantId));
    }
}
