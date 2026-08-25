using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Queries.GetTenantById;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Queries.GetSubscriptionCompany;

public sealed class GetSubscriptionCompanyHandler
    : IQueryHandler<GetSubscriptionCompanyQuery, GetTenantByIdResponse>
{
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;

    public GetSubscriptionCompanyHandler(
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants)
    {
        _accounts = accounts;
        _tenants = tenants;
    }

    public async Task<Result<GetTenantByIdResponse>> Handle(
        GetSubscriptionCompanyQuery query,
        CancellationToken ct)
    {
        var account = await _accounts.GetByIdAsync(query.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<GetTenantByIdResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var tenant = await _tenants.GetByIdAsync(query.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<GetTenantByIdResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        if (tenant.SubscriptionGroupId != account.SubscriptionGroupId)
        {
            return Result.Failure<GetTenantByIdResponse>(
                new Error("company.access.denied", "La empresa no pertenece a tu licencia.", ErrorType.Forbidden));
        }

        return Result.Success(TenantDetailMapper.Map(tenant));
    }
}
