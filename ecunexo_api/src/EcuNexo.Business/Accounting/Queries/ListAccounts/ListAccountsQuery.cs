using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Accounting;

namespace EcuNexo.Business.Accounting.Queries.ListAccounts;

public sealed record ListAccountsQuery(
    Guid TenantId,
    AccountType? Type = null,
    bool? AllowsMovementOnly = null,
    bool? ActiveOnly = null,
    string? Search = null) : IQuery<IReadOnlyList<AccountResponse>>;
