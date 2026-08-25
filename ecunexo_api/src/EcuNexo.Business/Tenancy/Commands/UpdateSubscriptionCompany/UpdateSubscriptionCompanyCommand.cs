using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Commands.UpdateSubscriptionCompany;

public sealed record UpdateSubscriptionCompanyCommand(
    Guid SubscriptionAccountId,
    Guid TenantId,
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
    RimpeKind RimpeKind,
    bool PreferElectronicInvoice,
    bool IsExporter,
    bool IsLargeTaxpayer,
    bool IsSpecialTaxpayer,
    bool IsWithholdingAgent,
    string? ContactEmail,
    string? ContactPhone,
    string? RideThankYouText) : ICommand<UpdateSubscriptionCompanyResponse>;

public sealed record UpdateSubscriptionCompanyResponse(Guid TenantId);
