using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Pricing;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Pricing;
using EcuNexo.Business.Pricing.Commands.CreatePriceList;
using EcuNexo.Business.Pricing.Commands.CreateProductPrice;
using EcuNexo.Business.Pricing.Commands.CreatePromotion;
using EcuNexo.Business.Pricing.Commands.DeletePriceList;
using EcuNexo.Business.Pricing.Commands.DeleteProductPrice;
using EcuNexo.Business.Pricing.Commands.DeletePromotion;
using EcuNexo.Business.Pricing.Commands.UpdatePriceList;
using EcuNexo.Business.Pricing.Commands.UpdateProductPrice;
using EcuNexo.Business.Pricing.Commands.UpdatePromotion;
using EcuNexo.Business.Pricing.Queries.GetPriceHistory;
using EcuNexo.Business.Pricing.Queries.GetProductPrice;
using EcuNexo.Business.Pricing.Queries.ListPriceLists;
using EcuNexo.Business.Pricing.Queries.ListProductPrices;
using EcuNexo.Business.Pricing.Queries.ListPromotions;
using EcuNexo.Business.Pricing.Queries.ResolvePrice;

namespace EcuNexo.Api.Endpoints.V1.Pricing;

public static class PricingEndpoints
{
    public static WebApplication MapPricingEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder priceLists = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/pricing/price-lists")
            .WithApiVersionSet(versionSet)
            .WithTags("Pricing")
            .RequireAuthorization();

        priceLists.MapGet("/", ListPriceListsAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.read"));
        priceLists.MapPost("/", CreatePriceListAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.create"));
        priceLists.MapPut("/{priceListId:guid}", UpdatePriceListAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.update"));
        priceLists.MapDelete("/{priceListId:guid}", DeletePriceListAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.delete"));

        RouteGroupBuilder prices = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/pricing/prices")
            .WithApiVersionSet(versionSet)
            .WithTags("Pricing")
            .RequireAuthorization();

        prices.MapGet("/", ListProductPricesAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.read"));
        prices.MapGet("/{priceId:guid}", GetProductPriceAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.read"));
        prices.MapGet("/history", GetPriceHistoryAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.history.read"));
        prices.MapPost("/", CreateProductPriceAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.create"));
        prices.MapPut("/{priceId:guid}", UpdateProductPriceAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.update"));
        prices.MapDelete("/{priceId:guid}", DeleteProductPriceAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.delete"));

        RouteGroupBuilder promotions = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/pricing/promotions")
            .WithApiVersionSet(versionSet)
            .WithTags("Pricing")
            .RequireAuthorization();

        promotions.MapGet("/", ListPromotionsAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.read"));
        promotions.MapPost("/", CreatePromotionAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.promotions.manage"));
        promotions.MapPut("/{promotionId:guid}", UpdatePromotionAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.promotions.manage"));
        promotions.MapDelete("/{promotionId:guid}", DeletePromotionAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.promotions.manage"));

        app.MapPost(
                "/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/pricing/resolve",
                ResolvePriceAsync)
            .WithApiVersionSet(versionSet)
            .WithTags("Pricing")
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.Require("catalog.pricing.read"));

        return app;
    }

    private static async Task<IResult> ListPriceListsAsync(
        Guid tenantId,
        bool? onlyActive,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListPriceListsQuery, IReadOnlyList<PriceListResponse>>(
                new ListPriceListsQuery(tenantId, onlyActive ?? true),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreatePriceListAsync(
        Guid tenantId,
        CreatePriceListRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreatePriceListCommand, CreatePriceListResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/catalog/pricing/price-lists/{value.PriceListId}",
            value);
    }

    private static async Task<IResult> UpdatePriceListAsync(
        Guid tenantId,
        Guid priceListId,
        UpdatePriceListRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdatePriceListCommand, UpdatePriceListResponse>(
                body.ToCommand(tenantId, priceListId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> DeletePriceListAsync(
        Guid tenantId,
        Guid priceListId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeletePriceListCommand, DeletePriceListResponse>(
                new DeletePriceListCommand(tenantId, priceListId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListProductPricesAsync(
        Guid tenantId,
        string? search,
        Guid? priceListId,
        Guid? categoryId,
        DateOnly? date,
        bool? onlyVigent,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListProductPricesQuery, IReadOnlyList<ProductPriceListItemResponse>>(
                new ListProductPricesQuery(tenantId, search, priceListId, categoryId, date, onlyVigent ?? true),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetProductPriceAsync(
        Guid tenantId,
        Guid priceId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetProductPriceQuery, ProductPriceDetailResponse>(
                new GetProductPriceQuery(tenantId, priceId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateProductPriceAsync(
        Guid tenantId,
        CreateProductPriceRequest body,
        ISender sender,
        CancellationToken ct)    {
        var result = await sender
            .SendAsync<CreateProductPriceCommand, CreateProductPriceResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/catalog/pricing/prices/{value.ProductPriceId}",
            value);
    }

    private static async Task<IResult> UpdateProductPriceAsync(
        Guid tenantId,
        Guid priceId,
        UpdateProductPriceRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateProductPriceCommand, UpdateProductPriceResponse>(
                body.ToCommand(tenantId, priceId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteProductPriceAsync(
        Guid tenantId,
        Guid priceId,
        string? reason,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeleteProductPriceCommand, DeleteProductPriceResponse>(
                new DeleteProductPriceCommand(tenantId, priceId, reason),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetPriceHistoryAsync(
        Guid tenantId,
        Guid? catalogItemId,
        Guid? priceListId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetPriceHistoryQuery, IReadOnlyList<PriceHistoryItemResponse>>(
                new GetPriceHistoryQuery(tenantId, catalogItemId, priceListId, from, to),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListPromotionsAsync(
        Guid tenantId,
        bool? onlyActive,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListPromotionsQuery, IReadOnlyList<PromotionResponse>>(
                new ListPromotionsQuery(tenantId, onlyActive ?? true),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreatePromotionAsync(
        Guid tenantId,
        CreatePromotionRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreatePromotionCommand, CreatePromotionResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/catalog/pricing/promotions/{value.PromotionId}",
            value);
    }

    private static async Task<IResult> UpdatePromotionAsync(
        Guid tenantId,
        Guid promotionId,
        UpdatePromotionRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdatePromotionCommand, UpdatePromotionResponse>(
                body.ToCommand(tenantId, promotionId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> DeletePromotionAsync(
        Guid tenantId,
        Guid promotionId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeletePromotionCommand, DeletePromotionResponse>(
                new DeletePromotionCommand(tenantId, promotionId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ResolvePriceAsync(
        Guid tenantId,
        ResolvePriceRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ResolvePriceQuery, PricingResult>(body.ToQuery(tenantId), ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
