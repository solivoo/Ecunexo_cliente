using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;

public sealed record UpdateTenantSriLegalCommand(
    Guid TenantId,
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
    bool IsWithholdingAgent) : ICommand<UpdateTenantSriLegalResponse>;

public sealed record UpdateTenantSriLegalResponse(Guid TenantId);
