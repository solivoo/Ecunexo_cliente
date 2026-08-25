using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateUserHandler : ICommandHandler<CreateUserCommand, CreateUserResponse>
{
    private readonly IValidator<CreateUserCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IUserRepository _users;
    private readonly IDepartmentRepository _departments;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;

    public CreateUserHandler(
        IValidator<CreateUserCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IUserRepository users,
        IDepartmentRepository departments,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _users = users;
        _departments = departments;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<CreateUserResponse>> Handle(CreateUserCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateUserResponse>(new Error("user.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateUserResponse>(
                new Error("user.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        Email email;
        try
        {
            email = new Email(command.Email);
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<CreateUserResponse>(
                new Error("user.email.invalid", ex.Message, ErrorType.Validation));
        }

        if (await _users.EmailExistsAsync(command.TenantId, email, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateUserResponse>(
                new Error(
                    "user.email.duplicate",
                    "Ya existe un usuario con este correo en el tenant.",
                    ErrorType.Conflict));
        }

        Guid? departmentId = null;
        string? departmentName = command.Department;
        if (command.DepartmentId is Guid deptId)
        {
            var dept = await _departments.GetActiveByIdAsync(command.TenantId, deptId, ct)
                .ConfigureAwait(false);
            if (dept is null)
            {
                return Result.Failure<CreateUserResponse>(
                    new Error(
                        "user.department.not_found",
                        "El departamento no existe en este tenant.",
                        ErrorType.NotFound));
            }

            departmentId = dept.Id;
            departmentName = dept.Name;
        }

        var id = _idGenerator.NewId();
        var created = User.Create(
            id,
            command.TenantId,
            email,
            command.Name,
            departmentName,
            command.Phone,
            command.JobTitle,
            departmentId);
        if (created.IsFailure)
        {
            return Result.Failure<CreateUserResponse>(created.Error!);
        }

        var user = created.Value!;
        var setPassword = user.SetPasswordHash(_passwordHasher.Hash(command.Password));
        if (setPassword.IsFailure)
        {
            return Result.Failure<CreateUserResponse>(setPassword.Error!);
        }

        await _users.AddAsync(user, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateUserResponse(user.Id, user.TenantId));
    }
}
