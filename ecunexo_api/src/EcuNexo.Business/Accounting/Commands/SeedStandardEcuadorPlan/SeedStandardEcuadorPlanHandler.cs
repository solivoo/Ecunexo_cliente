using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Accounting;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Commands.SeedStandardEcuadorPlan;

public sealed class SeedStandardEcuadorPlanHandler : ICommandHandler<SeedStandardEcuadorPlanCommand, int>
{
    private readonly IAccountRepository _accounts;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public SeedStandardEcuadorPlanHandler(
        IAccountRepository accounts,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<int>> Handle(SeedStandardEcuadorPlanCommand command, CancellationToken ct)
    {
        var existingAccounts = await _accounts.ListAsync(command.TenantId, null, null, null, null, ct).ConfigureAwait(false);
        var existingCodes = existingAccounts.ToDictionary(a => a.Code, a => a);

        var createdAccounts = new List<Account>();
        var mapByCode = new Dictionary<string, Account>(existingCodes);

        // Iterar en orden del catálogo (cuentas de mayor nivel a menor nivel para asegurar existencia de padres)
        foreach (var def in StandardEcuadorChartOfAccounts.DefaultCatalog.OrderBy(d => d.Code.Length).ThenBy(d => d.Code))
        {
            if (mapByCode.ContainsKey(def.Code))
            {
                continue;
            }

            Guid? parentId = null;
            string? parentCode = null;
            if (def.Code.Contains('.'))
            {
                parentCode = def.Code[..def.Code.LastIndexOf('.')];
                if (mapByCode.TryGetValue(parentCode, out var parentAccount))
                {
                    parentId = parentAccount.Id;
                }
            }

            var accountResult = Account.Create(
                _idGenerator.NewId(),
                command.TenantId,
                def.Code,
                def.Name,
                def.Type,
                def.Nature,
                parentId,
                parentCode,
                def.AllowsMovement,
                isSystem: true,
                def.Description,
                command.UserId);

            if (accountResult.IsSuccess)
            {
                var newAccount = accountResult.Value!;
                createdAccounts.Add(newAccount);
                mapByCode[def.Code] = newAccount;
            }
        }

        if (createdAccounts.Count > 0)
        {
            // Re-vincular padres para las cuentas creadas en caso de inserción en lote
            foreach (var account in createdAccounts)
            {
                if (account.ParentAccountId == null && !string.IsNullOrWhiteSpace(account.ParentCode))
                {
                    if (mapByCode.TryGetValue(account.ParentCode, out var parentAccount))
                    {
                        account.LinkParent(parentAccount.Id, account.ParentCode);
                    }
                }
            }

            await _accounts.AddRangeAsync(createdAccounts, ct).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        return Result.Success(createdAccounts.Count);
    }
}
