using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Tarifa de envío configurada por un tenant para un cantón específico del Ecuador,
/// con parámetros de peso base, kg adicional y factor volumétrico (modelo courier/Servientrega).
/// </summary>
public sealed class CantonShippingRate : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int EstimatedDaysMaxLength = 60;
    public const decimal DefaultBaseWeightKg = 2m;
    public const decimal DefaultVolumetricDivisor = 6000m;
    public const decimal DefaultTaxRate = 15m;

    private CantonShippingRate() { }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid CantonId { get; private set; }

    public EcuadorCanton? Canton { get; private set; }

    public Guid? ShippingMethodId { get; private set; }

    public ShippingMethod? ShippingMethod { get; private set; }

    public decimal BasePrice { get; private set; }

    public decimal BaseWeightKg { get; private set; } = DefaultBaseWeightKg;

    public decimal AdditionalKgPrice { get; private set; }

    public decimal VolumetricDivisor { get; private set; } = DefaultVolumetricDivisor;

    public bool RoundUpExtraKg { get; private set; } = true;

    public decimal? FreeShippingMinAmount { get; private set; }

    public decimal TaxRate { get; private set; } = DefaultTaxRate;

    public string? EstimatedDays { get; private set; }

    public bool IsEnabled { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<CantonShippingRate> Create(
        Guid id,
        Guid tenantId,
        Guid cantonId,
        Guid? shippingMethodId,
        decimal basePrice,
        decimal baseWeightKg,
        decimal additionalKgPrice,
        decimal volumetricDivisor,
        bool roundUpExtraKg,
        decimal? freeShippingMinAmount,
        decimal taxRate,
        string? estimatedDays,
        bool isEnabled,
        Guid? createdBy = null)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<CantonShippingRate>(
                new Error("logistics.canton_rate.tenant_invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (cantonId == Guid.Empty)
        {
            return Result.Failure<CantonShippingRate>(
                new Error("logistics.canton_rate.canton_invalid", "El cantón es obligatorio.", ErrorType.Validation));
        }

        var validation = ValidateParameters(
            basePrice,
            baseWeightKg,
            additionalKgPrice,
            volumetricDivisor,
            freeShippingMinAmount,
            taxRate,
            estimatedDays);
        if (validation.IsFailure)
        {
            return Result.Failure<CantonShippingRate>(validation.Error!);
        }

        return Result.Success(new CantonShippingRate
        {
            Id = id,
            TenantId = tenantId,
            CantonId = cantonId,
            ShippingMethodId = shippingMethodId,
            BasePrice = decimal.Round(basePrice, 2, MidpointRounding.AwayFromZero),
            BaseWeightKg = decimal.Round(baseWeightKg, 4, MidpointRounding.AwayFromZero),
            AdditionalKgPrice = decimal.Round(additionalKgPrice, 2, MidpointRounding.AwayFromZero),
            VolumetricDivisor = decimal.Round(volumetricDivisor, 2, MidpointRounding.AwayFromZero),
            RoundUpExtraKg = roundUpExtraKg,
            FreeShippingMinAmount = freeShippingMinAmount.HasValue
                ? decimal.Round(freeShippingMinAmount.Value, 2, MidpointRounding.AwayFromZero)
                : null,
            TaxRate = decimal.Round(taxRate, 2, MidpointRounding.AwayFromZero),
            EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim(),
            IsEnabled = isEnabled,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        });
    }

    public Result Update(
        decimal basePrice,
        decimal baseWeightKg,
        decimal additionalKgPrice,
        decimal volumetricDivisor,
        bool roundUpExtraKg,
        decimal? freeShippingMinAmount,
        decimal taxRate,
        string? estimatedDays,
        bool isEnabled,
        Guid? updatedBy = null)
    {
        var validation = ValidateParameters(
            basePrice,
            baseWeightKg,
            additionalKgPrice,
            volumetricDivisor,
            freeShippingMinAmount,
            taxRate,
            estimatedDays);
        if (validation.IsFailure)
        {
            return validation;
        }

        BasePrice = decimal.Round(basePrice, 2, MidpointRounding.AwayFromZero);
        BaseWeightKg = decimal.Round(baseWeightKg, 4, MidpointRounding.AwayFromZero);
        AdditionalKgPrice = decimal.Round(additionalKgPrice, 2, MidpointRounding.AwayFromZero);
        VolumetricDivisor = decimal.Round(volumetricDivisor, 2, MidpointRounding.AwayFromZero);
        RoundUpExtraKg = roundUpExtraKg;
        FreeShippingMinAmount = freeShippingMinAmount.HasValue
            ? decimal.Round(freeShippingMinAmount.Value, 2, MidpointRounding.AwayFromZero)
            : null;
        TaxRate = decimal.Round(taxRate, 2, MidpointRounding.AwayFromZero);
        EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim();
        IsEnabled = isEnabled;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    private static Result ValidateParameters(
        decimal basePrice,
        decimal baseWeightKg,
        decimal additionalKgPrice,
        decimal volumetricDivisor,
        decimal? freeShippingMinAmount,
        decimal taxRate,
        string? estimatedDays)
    {
        if (basePrice < 0)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.base_price", "La tarifa base no puede ser negativa.", ErrorType.Validation));
        }

        if (baseWeightKg <= 0)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.base_weight", "El peso base (kg) debe ser mayor a 0.", ErrorType.Validation));
        }

        if (additionalKgPrice < 0)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.additional_kg", "El precio por kg adicional no puede ser negativo.", ErrorType.Validation));
        }

        if (volumetricDivisor <= 0)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.volumetric_divisor", "El factor volumétrico debe ser mayor a 0.", ErrorType.Validation));
        }

        if (freeShippingMinAmount is < 0)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.free_min", "El monto mínimo de envío gratis no puede ser negativo.", ErrorType.Validation));
        }

        if (taxRate is < 0 or > 100)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.tax_rate", "El porcentaje de IVA debe estar entre 0 y 100.", ErrorType.Validation));
        }

        if (estimatedDays?.Trim().Length > EstimatedDaysMaxLength)
        {
            return Result.Failure(
                new Error("logistics.canton_rate.estimated_days", $"El tiempo estimado no puede superar {EstimatedDaysMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
