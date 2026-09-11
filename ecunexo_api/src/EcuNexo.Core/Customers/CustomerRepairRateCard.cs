using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Customers;

/// <summary>
/// Tarifario de reacondicionamiento pactado con un cliente corporativo (N1/N2/N3).
/// El lote conserva un snapshot al importar; este maestro precarga y centraliza el contrato.
/// </summary>
public sealed class CustomerRepairRateCard : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int ContractReferenceMaxLength = 120;

    private CustomerRepairRateCard()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid CustomerId { get; private set; }

    public Customer? Customer { get; private set; }

    public decimal? RateN1 { get; private set; }

    public decimal? RateN2 { get; private set; }

    public decimal? RateN3 { get; private set; }

    public string? ContractReference { get; private set; }

    public DateTimeOffset? ValidFrom { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<CustomerRepairRateCard> Create(
        Guid id,
        Guid tenantId,
        Guid customerId,
        decimal? rateN1,
        decimal? rateN2,
        decimal? rateN3,
        string? contractReference = null,
        DateTimeOffset? validFrom = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<CustomerRepairRateCard>(
                new Error("customer.rate_card.id.empty", "El Id del tarifario es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty || customerId == Guid.Empty)
        {
            return Result.Failure<CustomerRepairRateCard>(
                new Error("customer.rate_card.refs.empty", "Tenant y cliente son obligatorios.", ErrorType.Validation));
        }

        var ratesError = ValidateRates(rateN1, rateN2, rateN3);
        if (ratesError is not null)
        {
            return Result.Failure<CustomerRepairRateCard>(ratesError);
        }

        var contract = NormalizeContract(contractReference);
        if (contract is { Length: > ContractReferenceMaxLength })
        {
            return Result.Failure<CustomerRepairRateCard>(
                new Error(
                    "customer.rate_card.contract.toolong",
                    $"La referencia de contrato no puede exceder {ContractReferenceMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return new CustomerRepairRateCard
        {
            Id = id,
            TenantId = tenantId,
            CustomerId = customerId,
            RateN1 = rateN1,
            RateN2 = rateN2,
            RateN3 = rateN3,
            ContractReference = contract,
            ValidFrom = validFrom,
            CreatedBy = createdBy,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result UpdateRates(
        decimal? rateN1,
        decimal? rateN2,
        decimal? rateN3,
        string? contractReference = null,
        DateTimeOffset? validFrom = null,
        Guid? modifiedBy = null)
    {
        var ratesError = ValidateRates(rateN1, rateN2, rateN3);
        if (ratesError is not null)
        {
            return Result.Failure(ratesError);
        }

        var contract = NormalizeContract(contractReference);
        if (contract is { Length: > ContractReferenceMaxLength })
        {
            return Result.Failure(
                new Error(
                    "customer.rate_card.contract.toolong",
                    $"La referencia de contrato no puede exceder {ContractReferenceMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        RateN1 = rateN1;
        RateN2 = rateN2;
        RateN3 = rateN3;
        ContractReference = contract;
        ValidFrom = validFrom;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = modifiedBy;

        return Result.Success();
    }

    private static Error? ValidateRates(decimal? rateN1, decimal? rateN2, decimal? rateN3)
    {
        foreach (var (label, value) in new[]
                 {
                     ("N1", rateN1),
                     ("N2", rateN2),
                     ("N3", rateN3),
                 })
        {
            if (value is < 0)
            {
                return new Error(
                    "customer.rate_card.rate.negative",
                    $"La tarifa {label} no puede ser negativa.",
                    ErrorType.Validation);
            }
        }

        return null;
    }

    private static string? NormalizeContract(string? contractReference) =>
        string.IsNullOrWhiteSpace(contractReference) ? null : contractReference.Trim();
}
