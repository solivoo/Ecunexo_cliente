using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Accounting.Queries.ListAccounts;

public sealed class ListAccountsHandler : IQueryHandler<ListAccountsQuery, IReadOnlyList<AccountResponse>>
{
    private readonly IAccountRepository _accounts;

    public ListAccountsHandler(IAccountRepository accounts)
    {
        _accounts = accounts;
    }

    public async Task<Result<IReadOnlyList<AccountResponse>>> Handle(ListAccountsQuery query, CancellationToken ct)
    {
        var list = await _accounts.ListAsync(
            query.TenantId,
            query.Type,
            query.AllowsMovementOnly,
            query.ActiveOnly,
            query.Search,
            ct).ConfigureAwait(false);

        var response = list.Select(AccountResponse.FromDomain).ToList();
        return Result.Success<IReadOnlyList<AccountResponse>>(response);
    }
}
