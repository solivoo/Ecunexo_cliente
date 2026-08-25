using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.UpdateSubscriptionCompany;

public sealed class UpdateSubscriptionCompanyHandler
    : ICommandHandler<UpdateSubscriptionCompanyCommand, UpdateSubscriptionCompanyResponse>
{
    private readonly IValidator<UpdateSubscriptionCompanyCommand> _validator;
    private readonly ISubscriptionAccountRepository _accounts;
    private readonly ITenantRepository _tenants;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateSubscriptionCompanyHandler(
        IValidator<UpdateSubscriptionCompanyCommand> validator,
        ISubscriptionAccountRepository accounts,
        ITenantRepository tenants,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _accounts = accounts;
        _tenants = tenants;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateSubscriptionCompanyResponse>> Handle(
        UpdateSubscriptionCompanyCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateSubscriptionCompanyResponse>(
                new Error("company.update.validation", message, ErrorType.Validation));
        }

        var account = await _accounts.GetByIdAsync(command.SubscriptionAccountId, ct).ConfigureAwait(false);
        if (account is null)
        {
            return Result.Failure<UpdateSubscriptionCompanyResponse>(
                new Error("subscription.not_found", "Titular de licencia no encontrado.", ErrorType.NotFound));
        }

        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<UpdateSubscriptionCompanyResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        if (tenant.SubscriptionGroupId != account.SubscriptionGroupId)
        {
            return Result.Failure<UpdateSubscriptionCompanyResponse>(
                new Error("company.access.denied", "La empresa no pertenece a tu licencia.", ErrorType.Forbidden));
        }

        var updated = tenant.UpdateCompanyProfile(
            command.Name,
            command.TimeZoneId,
            command.Locale,
            tenant.LogoUrl,
            command.PrimaryColorHex,
            command.TaxId,
            command.LegalName,
            command.City,
            command.EstablishmentCode,
            command.Address,
            command.AccountingRequired,
            command.RimpeKind,
            command.PreferElectronicInvoice,
            command.IsExporter,
            command.IsLargeTaxpayer,
            command.IsSpecialTaxpayer,
            command.IsWithholdingAgent,
            command.ContactEmail,
            command.ContactPhone,
            command.RideThankYouText);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdateSubscriptionCompanyResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateSubscriptionCompanyResponse(tenant.Id));
    }
}
