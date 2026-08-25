using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Identity;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class CreatePermissionHandler : ICommandHandler<CreatePermissionCommand, CreatePermissionResponse>
{
    private readonly IValidator<CreatePermissionCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly IPermissionRepository _permissions;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePermissionHandler(
        IValidator<CreatePermissionCommand> validator,
        IIdGenerator idGenerator,
        IPermissionRepository permissions,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _permissions = permissions;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreatePermissionResponse>> Handle(CreatePermissionCommand command, CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<CreatePermissionResponse>(
                new Error("permission.create.validation", message, ErrorType.Validation));
        }

        var normalizedPreview = command.Code.Trim().ToLowerInvariant();
        if (await _permissions.CodeExistsAsync(normalizedPreview, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreatePermissionResponse>(
                new Error("permission.code.duplicate", "Ya existe un permiso con este código.", ErrorType.Conflict));
        }

        var id = _idGenerator.NewId();
        var created = Permission.Create(
            id,
            command.Code,
            command.Description,
            command.DisplayName,
            command.Module,
            command.SortOrder);
        if (created.IsFailure)
        {
            return Result.Failure<CreatePermissionResponse>(created.Error!);
        }

        var permission = created.Value!;
        await _permissions.AddAsync(permission, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreatePermissionResponse(permission.Id));
    }
}
