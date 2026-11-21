using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics.Queries.ListCantonShippingRates;

public sealed record ListCantonShippingRatesQuery(
    Guid TenantId,
    Guid ProvinceId,
    Guid? ShippingMethodId = null) : IQuery<IReadOnlyList<CantonShippingRateItemResponse>>;

public sealed record CantonShippingRateItemResponse(
    Guid CantonId,
    string CantonCode,
    string CantonName,
    bool IsProvincialCapital,
    Guid? RateId,
    bool IsConfigured,
    bool IsEnabled,
    decimal BasePrice,
    decimal BaseWeightKg,
    decimal AdditionalKgPrice,
    decimal VolumetricDivisor,
    bool RoundUpExtraKg,
    decimal? FreeShippingMinAmount,
    decimal TaxRate,
    string? EstimatedDays);

public sealed class ListCantonShippingRatesHandler
    : IQueryHandler<ListCantonShippingRatesQuery, IReadOnlyList<CantonShippingRateItemResponse>>
{
    private readonly IEcuadorGeoRepository _geo;
    private readonly ICantonShippingRateRepository _rates;

    public ListCantonShippingRatesHandler(
        IEcuadorGeoRepository geo,
        ICantonShippingRateRepository rates)
    {
        _geo = geo;
        _rates = rates;
    }

    public async Task<Result<IReadOnlyList<CantonShippingRateItemResponse>>> Handle(
        ListCantonShippingRatesQuery query,
        CancellationToken ct)
    {
        if (query.TenantId == Guid.Empty)
        {
            return Result.Failure<IReadOnlyList<CantonShippingRateItemResponse>>(
                new Error("logistics.canton_rate.tenant_invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (query.ProvinceId == Guid.Empty)
        {
            return Result.Failure<IReadOnlyList<CantonShippingRateItemResponse>>(
                new Error("logistics.canton_rate.province_invalid", "La provincia es obligatoria.", ErrorType.Validation));
        }

        var cantons = await _geo.ListCantonsByProvinceAsync(query.ProvinceId, ct).ConfigureAwait(false);
        var existingRates = await _rates
            .ListByProvinceAsync(query.TenantId, query.ProvinceId, query.ShippingMethodId, ct)
            .ConfigureAwait(false);

        var rateByCanton = existingRates.ToDictionary(r => r.CantonId);

        IReadOnlyList<CantonShippingRateItemResponse> items = cantons
            .Select(c =>
            {
                if (rateByCanton.TryGetValue(c.Id, out var r))
                {
                    return new CantonShippingRateItemResponse(
                        c.Id,
                        c.Code,
                        c.Name,
                        c.IsProvincialCapital,
                        r.Id,
                        IsConfigured: true,
                        r.IsEnabled,
                        r.BasePrice,
                        r.BaseWeightKg,
                        r.AdditionalKgPrice,
                        r.VolumetricDivisor,
                        r.RoundUpExtraKg,
                        r.FreeShippingMinAmount,
                        r.TaxRate,
                        r.EstimatedDays);
                }

                return new CantonShippingRateItemResponse(
                    c.Id,
                    c.Code,
                    c.Name,
                    c.IsProvincialCapital,
                    RateId: null,
                    IsConfigured: false,
                    IsEnabled: false,
                    BasePrice: 0m,
                    BaseWeightKg: CantonShippingRate.DefaultBaseWeightKg,
                    AdditionalKgPrice: 0m,
                    VolumetricDivisor: CantonShippingRate.DefaultVolumetricDivisor,
                    RoundUpExtraKg: true,
                    FreeShippingMinAmount: null,
                    TaxRate: CantonShippingRate.DefaultTaxRate,
                    EstimatedDays: null);
            })
            .ToList();

        return Result.Success(items);
    }
}
