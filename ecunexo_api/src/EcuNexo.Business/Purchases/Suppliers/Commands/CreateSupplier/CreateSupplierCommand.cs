using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.CreateSupplier;

public sealed record CreateSupplierCommand(
    Guid TenantId,
    string BusinessName,
    string TaxId,
    SupplierIdentificationType IdentificationType = SupplierIdentificationType.Ruc,
    SupplierTaxRegime TaxRegime = SupplierTaxRegime.General,
    string? TradeName = null,
    bool IsRetentionAgent = false,
    string? ResolutionNumber = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    string? Address = null,
    string? ContactPerson = null,
    int CreditDays = 0,
    decimal? CreditLimit = null,
    string? BankName = null,
    string? BankAccountType = null,
    string? BankAccountNumber = null,
    string? Notes = null,
    Guid? CreatedBy = null,
    bool ReturnExistingIfExists = false) : ICommand<SupplierResponse>;
