using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Identity.Commands;

public sealed class SoftDeleteUserHandler : ICommandHandler<SoftDeleteUserCommand, SoftDeleteUserResponse>
{
    private readonly IUserRepository _users;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICallerContext _caller;

    public SoftDeleteUserHandler(
        IUserRepository users,
        IUnitOfWork unitOfWork,
        ICallerContext caller)
    {
        _users = users;
        _unitOfWork = unitOfWork;
        _caller = caller;
    }

    public async Task<Result<SoftDeleteUserResponse>> Handle(
        SoftDeleteUserCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty || command.UserId == Guid.Empty)
        {
            return Result.Failure<SoftDeleteUserResponse>(
                new Error("user.delete.validation", "Tenant y usuario son obligatorios.", ErrorType.Validation));
        }

        if (_caller.UserId == command.UserId)
        {
            return Result.Failure<SoftDeleteUserResponse>(
                new Error(
                    "user.delete.self",
                    "No puedes eliminar tu propio usuario.",
                    ErrorType.Conflict));
        }

        var user = await _users.GetActiveByIdForUpdateAsync(command.TenantId, command.UserId, ct)
            .ConfigureAwait(false);
        if (user is null)
        {
            return Result.Failure<SoftDeleteUserResponse>(
                new Error("user.not_found", "El usuario no existe en este tenant.", ErrorType.NotFound));
        }

        var deleted = user.SoftDelete(DateTimeOffset.UtcNow, _caller.UserId);
        if (deleted.IsFailure)
        {
            return Result.Failure<SoftDeleteUserResponse>(deleted.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new SoftDeleteUserResponse(user.Id, user.TenantId));
    }
}
