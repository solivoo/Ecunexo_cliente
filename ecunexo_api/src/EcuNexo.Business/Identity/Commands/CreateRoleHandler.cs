using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreateRoleHandler : ICommandHandler<CreateRoleCommand, CreateRoleResponse>
{
    private readonly IValidator<CreateRoleCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ITenantRepository _tenants;
    private readonly IRoleRepository _roles;
    private readonly IUnitOfWork _unitOfWork;

    public CreateRoleHandler(
        IValidator<CreateRoleCommand> validator,
        IIdGenerator idGenerator,
        ITenantRepository tenants,
        IRoleRepository roles,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _tenants = tenants;
        _roles = roles;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateRoleResponse>> Handle(CreateRoleCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreateRoleResponse>(new Error("role.create.validation", message, ErrorType.Validation));
        }

        if (!await _tenants.ExistsByIdAsync(command.TenantId, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateRoleResponse>(
                new Error("role.tenant.not_found", "El tenant no existe.", ErrorType.NotFound));
        }

        if (await _roles.NameExistsIgnoreCaseAsync(command.TenantId, command.Name, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreateRoleResponse>(
                new Error(
                    "role.name.duplicate",
                    "Ya existe un rol con el mismo nombre en el tenant.",
                    ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var created = Role.Create(id, command.TenantId, command.Name, command.Description, command.IsSystem);
        if (created.IsFailure)
        {
            return Result.Failure<CreateRoleResponse>(created.Error!);
        }

        var role = created.Value!;
        await _roles.AddAsync(role, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateRoleResponse(role.Id, role.TenantId));
    }
}
