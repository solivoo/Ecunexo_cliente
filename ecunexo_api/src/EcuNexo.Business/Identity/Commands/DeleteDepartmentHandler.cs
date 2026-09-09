using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class DeleteDepartmentHandler : ICommandHandler<DeleteDepartmentCommand, DeleteDepartmentResponse>
{
    private readonly IValidator<DeleteDepartmentCommand> _validator;
    private readonly IDepartmentRepository _departments;
    private readonly IUserRepository _users;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteDepartmentHandler(
        IValidator<DeleteDepartmentCommand> validator,
        IDepartmentRepository departments,
        IUserRepository users,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _departments = departments;
        _users = users;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteDepartmentResponse>> Handle(
        DeleteDepartmentCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<DeleteDepartmentResponse>(
                new Error("department.delete.validation", message, ErrorType.Validation));
        }

        var department = await _departments
            .GetActiveByIdForUpdateAsync(command.TenantId, command.DepartmentId, ct)
            .ConfigureAwait(false);
        if (department is null)
        {
            return Result.Failure<DeleteDepartmentResponse>(
                new Error("department.not_found", "El departamento no existe.", ErrorType.NotFound));
        }

        if (Department.IsAdministrationAlias(department.Name))
        {
            return Result.Failure<DeleteDepartmentResponse>(
                new Error("department.system.protected", "No se puede eliminar el departamento de administración.", ErrorType.Conflict));
        }

        var assigned = await _users
            .ListActiveByDepartmentIdForUpdateAsync(command.TenantId, department.Id, ct)
            .ConfigureAwait(false);
        if (assigned.Count > 0)
        {
            return Result.Failure<DeleteDepartmentResponse>(
                new Error(
                    "department.has_users",
                    $"No se puede eliminar el departamento porque tiene {assigned.Count} usuario(s) asignado(s). Reasigna a los usuarios primero.",
                    ErrorType.Conflict));
        }

        var deletedBy = command.CurrentUserId ?? _caller.UserId;
        var deleted = department.SoftDelete(DateTimeOffset.UtcNow, deletedBy);
        if (deleted.IsFailure)
        {
            return Result.Failure<DeleteDepartmentResponse>(deleted.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new DeleteDepartmentResponse(department.Id, department.TenantId));
    }
}
