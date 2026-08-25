using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class UpdateUserHandler : ICommandHandler<UpdateUserCommand, UpdateUserResponse>
{
    private readonly IValidator<UpdateUserCommand> _validator;
    private readonly IUserRepository _users;
    private readonly IDepartmentRepository _departments;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateUserHandler(
        IValidator<UpdateUserCommand> validator,
        IUserRepository users,
        IDepartmentRepository departments,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _users = users;
        _departments = departments;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateUserResponse>> Handle(UpdateUserCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateUserResponse>(
                new Error("user.update.validation", message, ErrorType.Validation));
        }

        var user = await _users.GetActiveByIdForUpdateAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<UpdateUserResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        Guid? departmentId = null;
        string? departmentName = command.Department;
        if (command.DepartmentId is Guid deptId)
        {
            var dept = await _departments.GetActiveByIdAsync(command.TenantId, deptId, ct)
                .ConfigureAwait(false);
            if (dept is null)
            {
                return Result.Failure<UpdateUserResponse>(
                    new Error(
                        "user.department.not_found",
                        "El departamento no existe en este tenant.",
                        ErrorType.NotFound));
            }

            departmentId = dept.Id;
            departmentName = dept.Name;
        }

        var updated = user.UpdateProfile(
            command.Name,
            departmentName,
            command.Phone,
            command.JobTitle,
            departmentId);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateUserResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateUserResponse(user.Id, user.TenantId));
    }
}
