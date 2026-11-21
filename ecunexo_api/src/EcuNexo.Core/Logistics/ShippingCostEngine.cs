namespace EcuNexo.Core.Logistics;

public enum ShippingCalculatorStrategy
{
    WeightVolumetric = 0,
    FlatRate = 1,
}

public sealed record ShippingPackageItem(
    decimal? WeightKg,
    decimal Quantity,
    decimal? LengthCm = null,
    decimal? WidthCm = null,
    decimal? HeightCm = null);

public sealed record ShippingPackageDimensions(
    decimal LengthCm,
    decimal WidthCm,
    decimal HeightCm);

public sealed record ShippingCostCalculationInput(
    IReadOnlyList<ShippingPackageItem> Items,
    decimal OrderSubtotal,
    ShippingPackageDimensions? PackageDimensions = null,
    decimal? OverrideActualWeightKg = null,
    decimal DefaultItemWeightKg = 0m);

public sealed record ShippingCostCalculationResult(
    decimal ActualWeightKg,
    decimal VolumetricWeightKg,
    decimal ChargeableWeightKg,
    decimal VolumetricDivisor,
    decimal BaseWeightKg,
    decimal ExtraWeightKg,
    decimal BasePrice,
    decimal ExtraWeightCost,
    decimal Subtotal,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalPrice,
    bool IsFreeShipping,
    string? EstimatedDays,
    string StrategyName);

public interface IShippingCostCalculator
{
    ShippingCostCalculationResult Calculate(
        CantonShippingRate rate,
        ShippingCostCalculationInput input);
}

public interface IShippingCostCalculatorFactory
{
    IShippingCostCalculator Create(ShippingCalculatorStrategy strategy);
}

/// <summary>
/// Fábrica de calculadores de costo de envío. Permite extender estrategias por courier
/// (peso/volumen estilo Servientrega, tarifa plana, etc.) sin acoplar los handlers.
/// </summary>
public sealed class ShippingCostCalculatorFactory : IShippingCostCalculatorFactory
{
    public IShippingCostCalculator Create(ShippingCalculatorStrategy strategy) => strategy switch
    {
        ShippingCalculatorStrategy.WeightVolumetric => new WeightVolumetricShippingCalculator(),
        ShippingCalculatorStrategy.FlatRate => new FlatRateShippingCalculator(),
        _ => new WeightVolumetricShippingCalculator(),
    };
}

/// <summary>
/// Calculador estándar courier Ecuador (estilo Servientrega):
/// compara peso real vs peso volumétrico (L * A * H / Divisor), toma el mayor (peso facturable),
/// cobra tarifa base hasta BaseWeightKg y adiciona AdditionalKgPrice por cada kg extra.
/// </summary>
public sealed class WeightVolumetricShippingCalculator : IShippingCostCalculator
{
    public ShippingCostCalculationResult Calculate(
        CantonShippingRate rate,
        ShippingCostCalculationInput input)
    {
        var divisor = rate.VolumetricDivisor > 0
            ? rate.VolumetricDivisor
            : CantonShippingRate.DefaultVolumetricDivisor;

        var actualWeightKg = input.OverrideActualWeightKg is { } ov && ov >= 0
            ? ov
            : input.Items.Sum(i => Math.Max(0m, i.WeightKg ?? input.DefaultItemWeightKg) * Math.Max(0m, i.Quantity));

        decimal volumetricWeightKg = 0m;
        if (input.PackageDimensions is { LengthCm: > 0, WidthCm: > 0, HeightCm: > 0 } pkg)
        {
            volumetricWeightKg = (pkg.LengthCm * pkg.WidthCm * pkg.HeightCm) / divisor;
        }
        else
        {
            foreach (var item in input.Items)
            {
                if (item is { LengthCm: > 0, WidthCm: > 0, HeightCm: > 0 })
                {
                    var itemVol = (item.LengthCm.Value * item.WidthCm.Value * item.HeightCm.Value) / divisor;
                    volumetricWeightKg += itemVol * Math.Max(0m, item.Quantity);
                }
            }
        }

        actualWeightKg = decimal.Round(actualWeightKg, 4, MidpointRounding.AwayFromZero);
        volumetricWeightKg = decimal.Round(volumetricWeightKg, 4, MidpointRounding.AwayFromZero);
        var chargeableWeightKg = Math.Max(actualWeightKg, volumetricWeightKg);

        if (rate.FreeShippingMinAmount is { } freeMin && input.OrderSubtotal >= freeMin)
        {
            return new ShippingCostCalculationResult(
                actualWeightKg,
                volumetricWeightKg,
                chargeableWeightKg,
                divisor,
                rate.BaseWeightKg,
                0m,
                0m,
                0m,
                0m,
                rate.TaxRate,
                0m,
                0m,
                IsFreeShipping: true,
                rate.EstimatedDays,
                nameof(WeightVolumetricShippingCalculator));
        }

        var rawExtraKg = Math.Max(0m, chargeableWeightKg - rate.BaseWeightKg);
        var billedExtraKg = rate.RoundUpExtraKg && rawExtraKg > 0m
            ? Math.Ceiling(rawExtraKg)
            : rawExtraKg;

        var extraCost = decimal.Round(billedExtraKg * rate.AdditionalKgPrice, 2, MidpointRounding.AwayFromZero);
        var subtotal = decimal.Round(rate.BasePrice + extraCost, 2, MidpointRounding.AwayFromZero);
        var taxAmount = decimal.Round(subtotal * (rate.TaxRate / 100m), 2, MidpointRounding.AwayFromZero);
        var totalPrice = decimal.Round(subtotal + taxAmount, 2, MidpointRounding.AwayFromZero);

        return new ShippingCostCalculationResult(
            actualWeightKg,
            volumetricWeightKg,
            chargeableWeightKg,
            divisor,
            rate.BaseWeightKg,
            decimal.Round(billedExtraKg, 4, MidpointRounding.AwayFromZero),
            rate.BasePrice,
            extraCost,
            subtotal,
            rate.TaxRate,
            taxAmount,
            totalPrice,
            IsFreeShipping: false,
            rate.EstimatedDays,
            nameof(WeightVolumetricShippingCalculator));
    }
}

/// <summary>
/// Calculador de tarifa plana por cantón (ignora exceso de peso; aplica BasePrice + IVA).
/// </summary>
public sealed class FlatRateShippingCalculator : IShippingCostCalculator
{
    public ShippingCostCalculationResult Calculate(
        CantonShippingRate rate,
        ShippingCostCalculationInput input)
    {
        var divisor = rate.VolumetricDivisor > 0
            ? rate.VolumetricDivisor
            : CantonShippingRate.DefaultVolumetricDivisor;

        if (rate.FreeShippingMinAmount is { } freeMin && input.OrderSubtotal >= freeMin)
        {
            return new ShippingCostCalculationResult(
                0m, 0m, 0m, divisor, rate.BaseWeightKg, 0m, 0m, 0m, 0m,
                rate.TaxRate, 0m, 0m, true, rate.EstimatedDays, nameof(FlatRateShippingCalculator));
        }

        var subtotal = decimal.Round(rate.BasePrice, 2, MidpointRounding.AwayFromZero);
        var taxAmount = decimal.Round(subtotal * (rate.TaxRate / 100m), 2, MidpointRounding.AwayFromZero);
        var totalPrice = decimal.Round(subtotal + taxAmount, 2, MidpointRounding.AwayFromZero);

        return new ShippingCostCalculationResult(
            0m, 0m, 0m, divisor, rate.BaseWeightKg, 0m, rate.BasePrice, 0m, subtotal,
            rate.TaxRate, taxAmount, totalPrice, false, rate.EstimatedDays, nameof(FlatRateShippingCalculator));
    }
}
