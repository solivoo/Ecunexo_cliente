using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.CreateAccount;

public sealed class CreateAccountHandler : ICommandHandler<CreateAccountCommand, AccountResponse>
{
    private readonly IAccountRepository _accounts;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateAccountHandler(
        IAccountRepository accounts,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AccountResponse>> Handle(CreateAccountCommand command, CancellationToken ct)
    {
        if (await _accounts.ExistsByCodeAsync(command.TenantId, command.Code, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<AccountResponse>(
                new Error("accounting.account.code_duplicate", $"Ya existe una cuenta registrada con el código '{command.Code}'.", ErrorType.Conflict));
        }

        Guid? parentId = command.ParentAccountId;
        string? parentCode = command.ParentCode;

        if (parentId == null && command.Code.Contains('.'))
        {
            parentCode = command.Code[..command.Code.LastIndexOf('.')];
            var parentAccount = await _accounts.GetByCodeAsync(command.TenantId, parentCode, ct).ConfigureAwait(false);
            if (parentAccount != null)
            {
                parentId = parentAccount.Id;
            }
        }

        var accountResult = Account.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.Code,
            command.Name,
            command.AccountType,
            command.Nature,
            parentId,
            parentCode,
            command.AllowsMovement,
            isSystem: false,
            command.Description,
            command.UserId);

        if (accountResult.IsFailure)
        {
            return Result.Failure<AccountResponse>(accountResult.Error!);
        }

        var account = accountResult.Value!;
        await _accounts.AddAsync(account, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(AccountResponse.FromDomain(account));
    }
}
