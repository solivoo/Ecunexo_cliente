using EcuNexo.Business.Logistics;
using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Ecommerce;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Ecommerce.Storefront;

public sealed record ResolvedStorefrontShippingQuote(
    decimal Cost,
    bool IsFreeShipping,
    string CarrierName,
    string CantonName,
    string? ProvinceName);

public interface IStorefrontShippingService
{
    Task<IReadOnlyList<StorefrontShippingOptionDto>> ListOptionsForCantonAsync(
        Guid tenantId,
        Guid cantonId,
        decimal orderSubtotal,
        CancellationToken ct);

    Task<Result<ResolvedStorefrontShippingQuote>> ResolveAndValidateAsync(
        Guid tenantId,
        Guid cantonId,
        Guid shippingMethodId,
        decimal orderSubtotal,
        CancellationToken ct);
}

public sealed class StorefrontShippingService : IStorefrontShippingService
{
    private readonly ITenantRepository _tenants;
    private readonly IShippingMethodRepository _methods;
    private readonly ICantonShippingRateRepository _rates;
    private readonly IEcuadorGeoRepository _geo;
    private readonly IEcommerceStorefrontSettingsReader _settings;
    private readonly IShippingCostCalculatorFactory _calculatorFactory;

    public StorefrontShippingService(
        ITenantRepository tenants,
        IShippingMethodRepository methods,
        ICantonShippingRateRepository rates,
        IEcuadorGeoRepository geo,
        IEcommerceStorefrontSettingsReader settings,
        IShippingCostCalculatorFactory calculatorFactory)
    {
        _tenants = tenants;
        _methods = methods;
        _rates = rates;
        _geo = geo;
        _settings = settings;
        _calculatorFactory = calculatorFactory;
    }

    public async Task<IReadOnlyList<StorefrontShippingOptionDto>> ListOptionsForCantonAsync(
        Guid tenantId,
        Guid cantonId,
        decimal orderSubtotal,
        CancellationToken ct)
    {
        var destCanton = await _geo.GetCantonByIdAsync(cantonId, ct).ConfigureAwait(false);
        if (destCanton is null)
        {
            return [];
        }

        var originCanton = await ResolveOriginCantonAsync(tenantId, ct).ConfigureAwait(false);
        var activeMethods = await _methods
            .ListAsync(tenantId, onlyActive: true, ct)
            .ConfigureAwait(false);
        var cantonRates = await _rates
            .ListByCantonAsync(tenantId, cantonId, ct)
            .ConfigureAwait(false);

        var calculator = _calculatorFactory.Create(ShippingCalculatorStrategy.WeightVolumetric);
        var options = new List<StorefrontShippingOptionDto>();

        foreach (var method in activeMethods.OrderBy(m => m.SortOrder).ThenBy(m => m.Name))
        {
            if (originCanton is not null)
            {
                var routeCheck = method.ValidateRoute(
                    originCanton.ProvinceId,
                    destCanton.ProvinceId,
                    originCanton.Id,
                    destCanton.Id);
                if (routeCheck.IsFailure)
                {
                    continue;
                }
            }

            var rate = PickRate(cantonRates, originCanton?.Id, method.Id);
            if (rate is null || !rate.IsEnabled)
            {
                continue;
            }

            var calc = calculator.Calculate(
                rate,
                new ShippingCostCalculationInput([], Math.Max(0m, orderSubtotal)));

            options.Add(new StorefrontShippingOptionDto(
                Code: EcommerceShippingMethod.Courier.ToString(),
                ShippingMethodId: method.Id,
                Label: method.Name,
                Description: method.Description,
                EstimatedDays: !string.IsNullOrWhiteSpace(rate.EstimatedDays)
                    ? rate.EstimatedDays
                    : method.EstimatedDays,
                Cost: calc.TotalPrice,
                IsFreeShipping: calc.IsFreeShipping,
                FreeShippingMinAmount: rate.FreeShippingMinAmount));
        }

        var settings = await _settings.ResolveAsync(tenantId, ct).ConfigureAwait(false);
        var storePickup = settings.ShippingMethods
            .FirstOrDefault(o => o.Method == EcommerceShippingMethod.StorePickup);
        if (storePickup is not null)
        {
            options.Add(new StorefrontShippingOptionDto(
                Code: EcommerceShippingMethod.StorePickup.ToString(),
                ShippingMethodId: null,
                Label: EcommerceStorefrontLabels.ForShipping(EcommerceShippingMethod.StorePickup),
                Description: "Retira tu pedido directamente en nuestra tienda.",
                EstimatedDays: null,
                Cost: storePickup.Cost,
                IsFreeShipping: storePickup.Cost == 0m,
                FreeShippingMinAmount: null));
        }

        return options;
    }

    public async Task<Result<ResolvedStorefrontShippingQuote>> ResolveAndValidateAsync(
        Guid tenantId,
        Guid cantonId,
        Guid shippingMethodId,
        decimal orderSubtotal,
        CancellationToken ct)
    {
        var method = await _methods.GetByIdAsync(tenantId, shippingMethodId, ct).ConfigureAwait(false);
        if (method is null || !method.IsActive)
        {
            return Result.Failure<ResolvedStorefrontShippingQuote>(
                new Error(
                    "ecommerce.checkout.shipping_method_unavailable",
                    "El método de envío seleccionado no está disponible.",
                    ErrorType.Validation));
        }

        var destCanton = await _geo.GetCantonByIdAsync(cantonId, ct).ConfigureAwait(false);
        if (destCanton is null)
        {
            return Result.Failure<ResolvedStorefrontShippingQuote>(
                new Error(
                    "ecommerce.checkout.canton_invalid",
                    "El cantón de entrega seleccionado no es válido.",
                    ErrorType.Validation));
        }

        var originCanton = await ResolveOriginCantonAsync(tenantId, ct).ConfigureAwait(false);
        if (originCanton is not null)
        {
            var routeCheck = method.ValidateRoute(
                originCanton.ProvinceId,
                destCanton.ProvinceId,
                originCanton.Id,
                destCanton.Id);
            if (routeCheck.IsFailure)
            {
                return Result.Failure<ResolvedStorefrontShippingQuote>(routeCheck.Error!);
            }
        }

        var cantonRates = await _rates
            .ListByCantonAsync(tenantId, cantonId, ct)
            .ConfigureAwait(false);
        var rate = PickRate(cantonRates, originCanton?.Id, method.Id);
        if (rate is null || !rate.IsEnabled)
        {
            return Result.Failure<ResolvedStorefrontShippingQuote>(
                new Error(
                    "logistics.canton_rate.not_configured",
                    $"El método '{method.Name}' no tiene cobertura habilitada para {destCanton.Name}.",
                    ErrorType.Validation));
        }

        var calculator = _calculatorFactory.Create(ShippingCalculatorStrategy.WeightVolumetric);
        var calc = calculator.Calculate(
            rate,
            new ShippingCostCalculationInput([], Math.Max(0m, orderSubtotal)));

        return Result.Success(new ResolvedStorefrontShippingQuote(
            Cost: calc.TotalPrice,
            IsFreeShipping: calc.IsFreeShipping,
            CarrierName: method.Name,
            CantonName: destCanton.Name,
            ProvinceName: destCanton.Province?.Name));
    }

    private async Task<EcuadorCanton?> ResolveOriginCantonAsync(Guid tenantId, CancellationToken ct)
    {
        var primaryOriginId = await _rates
            .FindPrimaryOriginCantonIdAsync(tenantId, ct)
            .ConfigureAwait(false);
        if (primaryOriginId.HasValue)
        {
            var origin = await _geo.GetCantonByIdAsync(primaryOriginId.Value, ct).ConfigureAwait(false);
            if (origin is not null)
            {
                return origin;
            }
        }

        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is not null && !string.IsNullOrWhiteSpace(tenant.City))
        {
            return await _geo.FindCantonByNameAsync(tenant.City, ct).ConfigureAwait(false);
        }

        return null;
    }

    private static CantonShippingRate? PickRate(
        IReadOnlyList<CantonShippingRate> rates,
        Guid? originCantonId,
        Guid shippingMethodId)
    {
        if (originCantonId.HasValue)
        {
            var exact = rates.FirstOrDefault(r =>
                r.OriginCantonId == originCantonId && r.ShippingMethodId == shippingMethodId);
            if (exact is not null)
            {
                return exact;
            }
        }

        var byMethodAnyOrigin = rates.FirstOrDefault(r =>
            r.OriginCantonId == null && r.ShippingMethodId == shippingMethodId);
        if (byMethodAnyOrigin is not null)
        {
            return byMethodAnyOrigin;
        }

        if (originCantonId.HasValue)
        {
            var genericWithOrigin = rates.FirstOrDefault(r =>
                r.OriginCantonId == originCantonId && r.ShippingMethodId == null);
            if (genericWithOrigin is not null)
            {
                return genericWithOrigin;
            }
        }

        return rates.FirstOrDefault(r => r.OriginCantonId == null && r.ShippingMethodId == null);
    }
}
