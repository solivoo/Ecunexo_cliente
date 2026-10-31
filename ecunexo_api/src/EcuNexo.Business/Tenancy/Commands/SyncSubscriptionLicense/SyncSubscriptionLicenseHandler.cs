using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSubscriptionSession;
using EcuNexo.Business.Tenancy.Licensing;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.SyncSubscriptionLicense;

public sealed class SyncSubscriptionLicenseHandler
    : ICommandHandler<SyncSubscriptionLicenseCommand, SubscriptionSessionResponse>
{
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ILicenseComplianceService _compliance;
    private readonly ISender _sender;

    public SyncSubscriptionLicenseHandler(
        ISubscriptionAccountRepository accounts,
        ILicenseComplianceService compliance,
        ISender sender)
    {
        _accounts = accounts;
        _compliance = compliance;
        _sender = sender;
    }

    public async Task<Result<SubscriptionSessionResponse>> Handle(
        SyncSubscriptionLicenseCommand command,
        CancellationToken ct)
    {
        var account = await _accounts.GetByIdForUpdateAsync(command.SubscriptionAccountId, ct)
            .ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<SubscriptionSessionResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var syncResult = await _compliance.SyncLicenseOnlineAsync(account, ct).ConfigureAwait(false);
        if (syncResult.IsFailure)
        {
            return Result.Failure<SubscriptionSessionResponse>(syncResult.Error!);
        }

        return await _sender
            .AskAsync<GetSubscriptionSessionQuery, SubscriptionSessionResponse>(
                new GetSubscriptionSessionQuery(account.Id),
                ct)
            .ConfigureAwait(false);
    }
}
