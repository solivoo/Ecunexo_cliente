using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Identity.Commands;

public sealed class SetUserPasswordHandler : ICommandHandler<SetUserPasswordCommand, SetUserPasswordResponse>
{
    private readonly IValidator<SetUserPasswordCommand> _validator;
    private readonly IUserRepository _users;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;

    public SetUserPasswordHandler(
        IValidator<SetUserPasswordCommand> validator,
        IUserRepository users,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher)
    {
        _validator = validator;
        _users = users;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<SetUserPasswordResponse>> Handle(
        SetUserPasswordCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<SetUserPasswordResponse>(
                new Error("user.password.validation", message, ErrorType.Validation));
        }

        var user = await _users.GetActiveByIdForUpdateAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SetUserPasswordResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        if (user.IsDisabled)
        {
            return Result.Failure<SetUserPasswordResponse>(
                new Error(
                    "user.disabled",
                    "No se puede cambiar la contraseña de un usuario deshabilitado.",
                    ErrorType.Conflict));
        }

        var setPassword = user.SetPasswordHash(_passwordHasher.Hash(command.Password));
        if (setPassword.IsFailure)
        {
            return Result.Failure<SetUserPasswordResponse>(setPassword.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SetUserPasswordResponse(user.Id, user.TenantId));
    }
}
