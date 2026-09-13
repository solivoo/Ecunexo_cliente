using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.DeleteAccount;

public sealed class DeleteAccountHandler : ICommandHandler<DeleteAccountCommand, bool>
{
    private readonly IAccountRepository _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteAccountHandler(
        IAccountRepository accounts,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteAccountCommand command, CancellationToken ct)
    {
        var account = await _accounts.GetTrackedByIdAsync(command.TenantId, command.AccountId, ct).ConfigureAwait(false);
        if (account == null)
        {
            return Result.Failure<bool>(
                new Error("accounting.account.not_found", "La cuenta contable no existe.", ErrorType.NotFound));
        }

        var deleteResult = account.MarkAsDeleted(command.UserId);
        if (deleteResult.IsFailure)
        {
            return Result.Failure<bool>(deleteResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(true);
    }
}
