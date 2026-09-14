using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Suppliers.Commands.UpdateSupplier;

public sealed record UpdateSupplierCommand(
    Guid TenantId,
    Guid SupplierId,
    string BusinessName,
    string TaxId,
    SupplierIdentificationType IdentificationType,
    SupplierTaxRegime TaxRegime,
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
    Guid? DefaultExpenseTypeId = null,
    bool IsActive = true,
    Guid? UpdatedBy = null) : ICommand<SupplierResponse>;
