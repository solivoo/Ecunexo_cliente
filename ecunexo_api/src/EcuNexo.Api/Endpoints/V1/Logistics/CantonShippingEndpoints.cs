using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics.Commands.UpsertCantonShippingRatesBulk;
using EcuNexo.Business.Logistics.Queries.CalculateShippingCost;
using EcuNexo.Business.Logistics.Queries.ListCantonShippingRates;
using EcuNexo.Business.Logistics.Queries.ListEcuadorProvinces;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Api.Endpoints.V1.Logistics;

public static class CantonShippingEndpoints
{
    public static WebApplication MapCantonShippingEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder geoGroup = app
            .MapGroup("/api/v{version:apiVersion}/logistics/ecuador")
            .WithApiVersionSet(versionSet)
            .WithTags("Logistics")
            .RequireAuthorization();

        geoGroup.MapGet("/provinces", ListProvincesAsync);

        RouteGroupBuilder tenantGroup = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/logistics/canton-rates")
            .WithApiVersionSet(versionSet)
            .WithTags("Logistics")
            .RequireAuthorization();

        tenantGroup.MapGet("/", ListCantonRatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read"));

        tenantGroup.MapPut("/bulk", UpsertCantonRatesBulkAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.update", "catalog.pricing.create"));

        tenantGroup.MapPost("/calculate", CalculateShippingCostAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListProvincesAsync(
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListEcuadorProvincesQuery, IReadOnlyList<EcuadorProvinceResponse>>(
                new ListEcuadorProvincesQuery(),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ListCantonRatesAsync(
        Guid tenantId,
        Guid provinceId,
        Guid? shippingMethodId,
        Guid? originCantonId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListCantonShippingRatesQuery, IReadOnlyList<CantonShippingRateItemResponse>>(
                new ListCantonShippingRatesQuery(tenantId, provinceId, shippingMethodId, originCantonId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UpsertCantonRatesBulkAsync(
        Guid tenantId,
        UpsertCantonShippingRatesBulkRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var items = body.Items
            .Select(i => new CantonShippingRateUpsertItem(
                i.CantonId,
                i.BasePrice,
                i.BaseWeightKg,
                i.AdditionalKgPrice,
                i.VolumetricDivisor,
                i.RoundUpExtraKg,
                i.FreeShippingMinAmount,
                i.TaxRate,
                i.EstimatedDays,
                i.IsEnabled))
            .ToList();

        var result = await sender
            .SendAsync<UpsertCantonShippingRatesBulkCommand, UpsertCantonShippingRatesBulkResponse>(
                new UpsertCantonShippingRatesBulkCommand(tenantId, body.ShippingMethodId, items, body.OriginCantonId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CalculateShippingCostAsync(
        Guid tenantId,
        CalculateShippingCostRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var items = (body.Items ?? [])
            .Select(i => new ShippingPackageItem(
                i.WeightKg,
                i.Quantity,
                i.LengthCm,
                i.WidthCm,
                i.HeightCm))
            .ToList();

        var dims = body.PackageDimensions is { LengthCm: > 0, WidthCm: > 0, HeightCm: > 0 } d
            ? new ShippingPackageDimensions(d.LengthCm, d.WidthCm, d.HeightCm)
            : null;

        var result = await sender
            .AskAsync<CalculateShippingCostQuery, ShippingCostCalculationResult>(
                new CalculateShippingCostQuery(
                    tenantId,
                    body.CantonId,
                    body.ShippingMethodId,
                    body.Strategy ?? ShippingCalculatorStrategy.WeightVolumetric,
                    items,
                    body.OrderSubtotal,
                    dims,
                    body.OverrideActualWeightKg,
                    body.OriginCantonId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}

public sealed record CantonShippingRateBulkItemRequest(
    Guid CantonId,
    decimal BasePrice,
    decimal BaseWeightKg,
    decimal AdditionalKgPrice,
    decimal VolumetricDivisor,
    bool RoundUpExtraKg,
    decimal? FreeShippingMinAmount,
    decimal TaxRate,
    string? EstimatedDays,
    bool IsEnabled);

public sealed record UpsertCantonShippingRatesBulkRequest(
    Guid? ShippingMethodId,
    IReadOnlyList<CantonShippingRateBulkItemRequest> Items,
    Guid? OriginCantonId = null);

public sealed record CalculateShippingItemRequest(
    decimal? WeightKg,
    decimal Quantity,
    decimal? LengthCm = null,
    decimal? WidthCm = null,
    decimal? HeightCm = null);

public sealed record CalculateShippingPackageDimensionsRequest(
    decimal LengthCm,
    decimal WidthCm,
    decimal HeightCm);

public sealed record CalculateShippingCostRequest(
    Guid CantonId,
    Guid? ShippingMethodId,
    ShippingCalculatorStrategy? Strategy,
    IReadOnlyList<CalculateShippingItemRequest>? Items,
    decimal OrderSubtotal,
    CalculateShippingPackageDimensionsRequest? PackageDimensions = null,
    decimal? OverrideActualWeightKg = null,
    Guid? OriginCantonId = null);
