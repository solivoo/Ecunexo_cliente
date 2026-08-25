using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Settings;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Platform.Queries.GetResolvedSettings;

public sealed class GetResolvedSettingsHandler
    : IQueryHandler<GetResolvedSettingsQuery, GetResolvedSettingsResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ISettingsResolver _resolver;

    public GetResolvedSettingsHandler(
        ITenantRepository tenants,
        ISubscriptionAccountRepository accounts,
        ISettingsResolver resolver)
    {
        _tenants = tenants;
        _accounts = accounts;
        _resolver = resolver;
    }

    public async Task<Result<GetResolvedSettingsResponse>> Handle(
        GetResolvedSettingsQuery query,
        CancellationToken ct)
    {
        if (query.ActorId == Guid.Empty)
        {
            return Result.Failure<GetResolvedSettingsResponse>(
                new Error("auth.user_id.required", "Falta identidad de usuario.", ErrorType.Unauthorized));
        }

        if (query.IsSubscriptionHolder)
        {
            var account = await _accounts.GetByIdAsync(query.ActorId, ct).ConfigureAwait(false);
            if (account is null)
            {
                return Result.Failure<GetResolvedSettingsResponse>(
                    new Error("settings.subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
            }

            var holderSettings = await _resolver
                .ResolveAsync(Guid.Empty, query.ActorId, account.ServicePlan.Name, ct)
                .ConfigureAwait(false);
            return Result.Success(new GetResolvedSettingsResponse(holderSettings));
        }

        if (query.TenantId is not { } tenantId)
        {
            return Result.Failure<GetResolvedSettingsResponse>(
                new Error("auth.tenant.required", "Se requiere tenant.", ErrorType.Validation));
        }

        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<GetResolvedSettingsResponse>(
                new Error("settings.tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var settings = await _resolver
            .ResolveAsync(tenantId, query.ActorId, tenant.ServicePlan.Name, ct)
            .ConfigureAwait(false);
        return Result.Success(new GetResolvedSettingsResponse(settings));
    }
}
