using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateDepartmentHandler : ICommandHandler<CreateDepartmentCommand, CreateDepartmentResponse>
{
    private readonly IValidator<CreateDepartmentCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IDepartmentRepository _departments;
    private readonly IUnitOfWork _unitOfWork;

    public CreateDepartmentHandler(
        IValidator<CreateDepartmentCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IDepartmentRepository departments,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _departments = departments;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateDepartmentResponse>> Handle(
        CreateDepartmentCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateDepartmentResponse>(
                new Error("department.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateDepartmentResponse>(
                new Error("department.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        if (await _departments.NameExistsIgnoreCaseAsync(command.TenantId, command.Name, ct)
            .ConfigureAwait(false))
        {
            return Result.Failure<CreateDepartmentResponse>(
                new Error(
                    "department.name.duplicate",
                    "Ya existe un departamento con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var created = Department.Create(id, command.TenantId, command.Name, command.Description);
        if (created.IsFailure)
        {
            return Result.Failure<CreateDepartmentResponse>(created.Error!);
        }

        var department = created.Value!;
        await _departments.AddAsync(department, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateDepartmentResponse(department.Id, department.TenantId));
    }
}
