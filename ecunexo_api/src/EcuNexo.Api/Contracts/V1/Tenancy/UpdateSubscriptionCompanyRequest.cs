using EcuNexo.Business.Tenancy.Commands.UpdateSubscriptionCompany;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record UpdateSubscriptionCompanyRequest(
    string Name,
    string? TimeZoneId,
    string? Locale,
    string? LogoUrl,
    string? PrimaryColorHex,
    string? TaxId,
    string? LegalName,
    string? City,
    string? EstablishmentCode,
    string? Address,
    bool AccountingRequired,
    bool IsRimpe,
    string? RimpeKind,
    bool PreferElectronicInvoice,
    bool IsExporter,
    bool IsLargeTaxpayer,
    bool IsSpecialTaxpayer,
    bool IsWithholdingAgent,
    string? ContactEmail,
    string? ContactPhone,
    string? RideThankYouText)
{
    public UpdateSubscriptionCompanyCommand ToCommand(Guid subscriptionAccountId, Guid tenantId) =>
        new(
            subscriptionAccountId,
            tenantId,
            Name,
            TimeZoneId,
            Locale,
            LogoUrl,
            PrimaryColorHex,
            TaxId,
            LegalName,
            City,
            EstablishmentCode,
            Address,
            AccountingRequired,
            RimpeKindCodes.FromApi(RimpeKind, IsRimpe),
            PreferElectronicInvoice,
            IsExporter,
            IsLargeTaxpayer,
            IsSpecialTaxpayer,
            IsWithholdingAgent,
            ContactEmail,
            ContactPhone,
            RideThankYouText);
}
