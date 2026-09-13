using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.UpdateAccount;

public sealed class UpdateAccountHandler : ICommandHandler<UpdateAccountCommand, AccountResponse>
{
    private readonly IAccountRepository _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateAccountHandler(
        IAccountRepository accounts,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AccountResponse>> Handle(UpdateAccountCommand command, CancellationToken ct)
    {
        var account = await _accounts.GetTrackedByIdAsync(command.TenantId, command.AccountId, ct).ConfigureAwait(false);
        if (account == null)
        {
            return Result.Failure<AccountResponse>(
                new Error("accounting.account.not_found", "La cuenta contable no existe.", ErrorType.NotFound));
        }

        var updateResult = account.Update(
            command.Name,
            command.Description,
            command.AllowsMovement,
            command.IsActive,
            command.Nature,
            command.UserId);

        if (updateResult.IsFailure)
        {
            return Result.Failure<AccountResponse>(updateResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(AccountResponse.FromDomain(account));
    }
}
