using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Suppliers;

public sealed record SupplierResponse(
    Guid Id,
    Guid TenantId,
    string BusinessName,
    string? TradeName,
    SupplierIdentificationType IdentificationType,
    string TaxId,
    SupplierTaxRegime TaxRegime,
    bool IsRetentionAgent,
    string? ResolutionNumber,
    string? ContactEmail,
    string? ContactPhone,
    string? Address,
    string? ContactPerson,
    int CreditDays,
    decimal? CreditLimit,
    string? BankName,
    string? BankAccountType,
    string? BankAccountNumber,
    string? Notes,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt)
{
    public static SupplierResponse FromDomain(Supplier s) => new(
        s.Id,
        s.TenantId,
        s.BusinessName,
        s.TradeName,
        s.IdentificationType,
        s.TaxId,
        s.TaxRegime,
        s.IsRetentionAgent,
        s.ResolutionNumber,
        s.ContactEmail,
        s.ContactPhone,
        s.Address,
        s.ContactPerson,
        s.CreditDays,
        s.CreditLimit,
        s.BankName,
        s.BankAccountType,
        s.BankAccountNumber,
        s.Notes,
        s.IsActive,
        s.CreatedAt,
        s.UpdatedAt);
}
