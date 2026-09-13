using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;
using FluentValidation;

namespace EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;

public sealed class UpdateTenantSriLegalHandler
    : ICommandHandler<UpdateTenantSriLegalCommand, UpdateTenantSriLegalResponse>
{
    private readonly IValidator<UpdateTenantSriLegalCommand> _validator;
    private readonly ITenantRepository _tenants;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateTenantSriLegalHandler(
        IValidator<UpdateTenantSriLegalCommand> validator,
        ITenantRepository tenants,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _tenants = tenants;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateTenantSriLegalResponse>> Handle(
        UpdateTenantSriLegalCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<UpdateTenantSriLegalResponse>(
                new Error("tenant.sri_legal.validation", message, ErrorType.Validation));
        }

        if (!_caller.IsSubscriptionHolder && _caller.ExplicitTenantId.HasValue && _caller.ExplicitTenantId.Value != command.TenantId)
        {
            return Result.Failure<UpdateTenantSriLegalResponse>(
                new Error("tenant.access.denied", "No tienes acceso a esta empresa.", ErrorType.Forbidden));
        }

        var tenant = await _tenants.GetByIdForUpdateAsync(command.TenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure<UpdateTenantSriLegalResponse>(
                new Error("tenant.not_found", "La empresa no existe.", ErrorType.NotFound));
        }

        var rimpeKind = RimpeKind.None;
        if (!string.IsNullOrWhiteSpace(command.RimpeKind) &&
            Enum.TryParse<RimpeKind>(command.RimpeKind, true, out var parsedRimpe))
        {
            rimpeKind = parsedRimpe;
        }

        var companyName = !string.IsNullOrWhiteSpace(command.TradeName)
            ? command.TradeName.Trim()
            : tenant.Name;

        var updated = tenant.UpdateCompanyProfile(
            companyName,
            tenant.TimeZoneId,
            tenant.Locale,
            tenant.LogoUrl,
            tenant.PrimaryColorHex,
            command.TaxId,
            command.LegalName,
            command.City,
            command.EstablishmentCode,
            command.Address,
            command.AccountingRequired,
            rimpeKind,
            command.PreferElectronicInvoice,
            command.IsExporter,
            command.IsLargeTaxpayer,
            command.IsSpecialTaxpayer,
            command.IsWithholdingAgent,
            tenant.ContactEmail,
            tenant.ContactPhone,
            tenant.RideThankYouText);

        if (updated.IsFailure)
        {
            return Result.Failure<UpdateTenantSriLegalResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateTenantSriLegalResponse(tenant.Id));
    }
}
