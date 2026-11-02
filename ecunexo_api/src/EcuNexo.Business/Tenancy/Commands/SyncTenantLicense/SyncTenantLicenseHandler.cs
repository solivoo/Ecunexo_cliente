using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSession;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.SyncTenantLicense;

public sealed class SyncTenantLicenseHandler
    : ICommandHandler<SyncTenantLicenseCommand, SessionResponse>
{
    private readonly ITenantRepository _tenants;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ILicenseComplianceService _compliance;
    private readonly ISender _sender;

    public SyncTenantLicenseHandler(
        ITenantRepository tenants,
        ISubscriptionAccountRepository accounts,
        ILicenseComplianceService compliance,
        ISender sender)
    {
        _tenants = tenants;
        _accounts = accounts;
        _compliance = compliance;
        _sender = sender;
    }

    public async Task<Result<SessionResponse>> Handle(
        SyncTenantLicenseCommand command,
        CancellationToken ct)
    {
        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<SessionResponse>(
                new Error("session.tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var account = await _accounts
            .GetBySubscriptionGroupIdForUpdateAsync(tenant.SubscriptionGroupId, ct)
            .ConfigureAwait(false);
        if (account is not null)
        {
            var syncResult = await _compliance.SyncLicenseOnlineAsync(account, ct).ConfigureAwait(false);
            if (syncResult.IsFailure)
            {
                return Result.Failure<SessionResponse>(syncResult.Error!);
            }
        }

        return await _sender
            .AskAsync<GetSessionQuery, SessionResponse>(
                new GetSessionQuery(command.TenantId, command.UserId),
                ct)
            .ConfigureAwait(false);
    }
}
