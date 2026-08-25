using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UpdateDepartmentHandler : ICommandHandler<UpdateDepartmentCommand, UpdateDepartmentResponse>
{
    private readonly IValidator<UpdateDepartmentCommand> _validator;
    private readonly IDepartmentRepository _departments;
    private readonly IUserRepository _users;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateDepartmentHandler(
        IValidator<UpdateDepartmentCommand> validator,
        IDepartmentRepository departments,
        IUserRepository users,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _departments = departments;
        _users = users;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateDepartmentResponse>> Handle(
        UpdateDepartmentCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateDepartmentResponse>(
                new Error("department.update.validation", message, ErrorType.Validation));
        }

        var department = await _departments
            .GetActiveByIdForUpdateAsync(command.TenantId, command.DepartmentId, ct)
            .ConfigureAwait(false);
        if (department is null)
        {
            return Result.Failure<UpdateDepartmentResponse>(
                new Error("department.not_found", "El departamento no existe.", ErrorType.NotFound));
        }

        if (await _departments
            .NameExistsIgnoreCaseAsync(command.TenantId, command.Name, ct, command.DepartmentId)
            .ConfigureAwait(false))
        {
            return Result.Failure<UpdateDepartmentResponse>(
                new Error(
                    "department.name.duplicate",
                    "Ya existe un departamento con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var renamed = department.Rename(command.Name, command.Description);
        if (renamed.IsFailure)
        {
            return Result.Failure<UpdateDepartmentResponse>(renamed.Error!);
        }

        var assigned = await _users
            .ListActiveByDepartmentIdForUpdateAsync(command.TenantId, department.Id, ct)
            .ConfigureAwait(false);
        foreach (var user in assigned)
        {
            var synced = user.SyncOrgDepartmentLabel(department.Name);
            if (synced.IsFailure)
            {
                return Result.Failure<UpdateDepartmentResponse>(synced.Error!);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateDepartmentResponse(department.Id, department.TenantId));
    }
}
