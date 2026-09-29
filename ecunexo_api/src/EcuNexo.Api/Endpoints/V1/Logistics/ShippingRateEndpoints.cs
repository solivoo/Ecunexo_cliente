using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics;
using EcuNexo.Business.Logistics.Commands.CreateShippingRateRule;
using EcuNexo.Business.Logistics.Commands.DeleteShippingRateRule;
using EcuNexo.Business.Logistics.Commands.UpdateShippingRateRule;
using EcuNexo.Business.Logistics.Queries.ListShippingRateRules;
using EcuNexo.Business.Logistics.Queries.ResolveShippingRates;

namespace EcuNexo.Api.Endpoints.V1.Logistics;

public static class ShippingRateEndpoints
{
    public static WebApplication MapShippingRateEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/logistics/shipping-rates")
            .WithApiVersionSet(versionSet)
            .WithTags("Logistics")
            .RequireAuthorization();

        group.MapGet("/", ListShippingRatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read", "facturacion.facturas.read"));

        group.MapPost("/", CreateShippingRateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.create"));

        group.MapPut("/{ruleId:guid}", UpdateShippingRateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.update"));

        group.MapDelete("/{ruleId:guid}", DeleteShippingRateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.delete"));

        group.MapPost("/resolve", ResolveShippingRatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.facturas.create", "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListShippingRatesAsync(
        Guid tenantId,
        string? carrier,
        string? zone,
        bool? onlyActive,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListShippingRateRulesQuery, IReadOnlyList<ShippingRateRuleDto>>(
                new ListShippingRateRulesQuery(tenantId, carrier, zone, onlyActive ?? false),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateShippingRateAsync(
        Guid tenantId,
        CreateShippingRateRuleInput body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateShippingRateRuleCommand, ShippingRateRuleDto>(
                new CreateShippingRateRuleCommand(tenantId, body),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateShippingRateAsync(
        Guid tenantId,
        Guid ruleId,
        UpdateShippingRateRuleInput body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateShippingRateRuleCommand, ShippingRateRuleDto>(
                new UpdateShippingRateRuleCommand(tenantId, ruleId, body),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteShippingRateAsync(
        Guid tenantId,
        Guid ruleId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeleteShippingRateRuleCommand, bool>(
                new DeleteShippingRateRuleCommand(tenantId, ruleId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ResolveShippingRatesAsync(
        Guid tenantId,
        ResolveShippingRatesInput body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ResolveShippingRatesQuery, IReadOnlyList<ResolvedShippingOptionDto>>(
                new ResolveShippingRatesQuery(tenantId, body),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
