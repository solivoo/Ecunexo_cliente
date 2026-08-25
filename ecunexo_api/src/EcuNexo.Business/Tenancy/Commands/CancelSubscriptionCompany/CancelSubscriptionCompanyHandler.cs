using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Commands.CancelSubscriptionCompany;

public sealed class CancelSubscriptionCompanyHandler
    : ICommandHandler<CancelSubscriptionCompanyCommand, CancelSubscriptionCompanyResponse>
{
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;

    public CancelSubscriptionCompanyHandler(
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CancelSubscriptionCompanyResponse>> Handle(
        CancelSubscriptionCompanyCommand command,
        CancellationToken ct)
    {
        var account = await _accounts.GetByIdAsync(command.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<CancelSubscriptionCompanyResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<CancelSubscriptionCompanyResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        if (tenant.SubscriptionGroupId != account.SubscriptionGroupId)
        {
            return Result.Failure<CancelSubscriptionCompanyResponse>(
                new Error("company.access.denied", "La empresa no pertenece a tu licencia.", ErrorType.Forbidden));
        }

        var cancelled = tenant.Cancel();
        if (cancelled.IsFailure)
        {
            return Result.Failure<CancelSubscriptionCompanyResponse>(cancelled.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CancelSubscriptionCompanyResponse(tenant.Id, tenant.Status));
    }
}
