using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Commands;

public sealed class SetUserDisabledHandler : ICommandHandler<SetUserDisabledCommand, SetUserDisabledResponse>
{
    private readonly IUserRepository _users;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICallerContext _caller;

    public SetUserDisabledHandler(
        IUserRepository users,
        IUnitOfWork unitOfWork,
        ICallerContext caller)
    {
        _users = users;
        _unitOfWork = unitOfWork;
        _caller = caller;
    }

    public async Task<Result<SetUserDisabledResponse>> Handle(
        SetUserDisabledCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty || command.UserId == Guid.Empty)
        {
            return Result.Failure<SetUserDisabledResponse>(
                new Error("user.disable.validation", "Tenant y usuario son obligatorios.", ErrorType.Validation));
        }

        if (_caller.UserId == command.UserId)
        {
            return Result.Failure<SetUserDisabledResponse>(
                new Error(
                    "user.disable.self",
                    "No puedes deshabilitar tu propio usuario.",
                    ErrorType.Conflict));
        }

        var user = await _users.GetActiveByIdForUpdateAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SetUserDisabledResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        var result = command.Disabled ? user.Disable() : user.Enable();
        if (result.IsFailure)
        {
            return Result.Failure<SetUserDisabledResponse>(result.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SetUserDisabledResponse(user.Id, user.TenantId, user.IsDisabled));
    }
}
