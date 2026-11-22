using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics.Queries.CalculateShippingCost;

public sealed record CalculateShippingCostQuery(
    Guid TenantId,
    Guid CantonId,
    Guid? ShippingMethodId,
    ShippingCalculatorStrategy Strategy,
    IReadOnlyList<ShippingPackageItem> Items,
    decimal OrderSubtotal,
    ShippingPackageDimensions? PackageDimensions = null,
    decimal? OverrideActualWeightKg = null,
    Guid? OriginCantonId = null) : IQuery<ShippingCostCalculationResult>;

public sealed class CalculateShippingCostHandler
    : IQueryHandler<CalculateShippingCostQuery, ShippingCostCalculationResult>
{
    private readonly ICantonShippingRateRepository _rates;
    private readonly IShippingMethodRepository _methods;
    private readonly IEcuadorGeoRepository _geo;
    private readonly IShippingCostCalculatorFactory _calculatorFactory;

    public CalculateShippingCostHandler(
        ICantonShippingRateRepository rates,
        IShippingMethodRepository methods,
        IEcuadorGeoRepository geo,
        IShippingCostCalculatorFactory calculatorFactory)
    {
        _rates = rates;
        _methods = methods;
        _geo = geo;
        _calculatorFactory = calculatorFactory;
    }

    public async Task<Result<ShippingCostCalculationResult>> Handle(
        CalculateShippingCostQuery query,
        CancellationToken ct)
    {
        if (query.ShippingMethodId is { } methodId && query.OriginCantonId is { } originCantonId)
        {
            var method = await _methods.GetByIdAsync(query.TenantId, methodId, ct).ConfigureAwait(false);
            var originCanton = await _geo.GetCantonByIdAsync(originCantonId, ct).ConfigureAwait(false);
            var destCanton = await _geo.GetCantonByIdAsync(query.CantonId, ct).ConfigureAwait(false);
            if (method is not null && originCanton is not null && destCanton is not null)
            {
                var routeValidation = method.ValidateRoute(originCanton.ProvinceId, destCanton.ProvinceId);
                if (routeValidation.IsFailure)
                {
                    return Result.Failure<ShippingCostCalculationResult>(routeValidation.Error!);
                }
            }
        }

        var rate = await ResolveRateAsync(query, ct).ConfigureAwait(false);

        if (rate is null || !rate.IsEnabled)
        {
            return Result.Failure<ShippingCostCalculationResult>(
                new Error(
                    "logistics.canton_rate.not_configured",
                    "No existe una tarifa de envío habilitada para el cantón seleccionado.",
                    ErrorType.NotFound));
        }

        var calculator = _calculatorFactory.Create(query.Strategy);
        var result = calculator.Calculate(
            rate,
            new ShippingCostCalculationInput(
                query.Items,
                query.OrderSubtotal,
                query.PackageDimensions,
                query.OverrideActualWeightKg));

        return Result.Success(result);
    }

    private async Task<CantonShippingRate?> ResolveRateAsync(
        CalculateShippingCostQuery query,
        CancellationToken ct)
    {
        var candidates = new List<(Guid? OriginId, Guid? MethodId)>
        {
            (query.OriginCantonId, query.ShippingMethodId),
        };
        if (query.ShippingMethodId.HasValue)
        {
            candidates.Add((query.OriginCantonId, null));
        }

        if (query.OriginCantonId.HasValue)
        {
            candidates.Add((null, query.ShippingMethodId));
            if (query.ShippingMethodId.HasValue)
            {
                candidates.Add((null, null));
            }
        }

        foreach (var (originId, methodId) in candidates)
        {
            var rate = await _rates
                .GetByCantonAsync(query.TenantId, query.CantonId, methodId, originId, ct)
                .ConfigureAwait(false);
            if (rate is not null)
            {
                return rate;
            }
        }

        return null;
    }
}
