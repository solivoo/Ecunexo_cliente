using EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;

namespace EcuNexo.Api.Contracts.V1.Tenancy;

public sealed record UpdateTenantSriLegalRequest(
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
    bool IsWithholdingAgent)
{
    public UpdateTenantSriLegalCommand ToCommand(Guid tenantId) =>
        new(
            tenantId,
            TaxId,
            LegalName,
            City,
            EstablishmentCode,
            Address,
            AccountingRequired,
            IsRimpe,
            RimpeKind,
            PreferElectronicInvoice,
            IsExporter,
            IsLargeTaxpayer,
            IsSpecialTaxpayer,
            IsWithholdingAgent);
}
