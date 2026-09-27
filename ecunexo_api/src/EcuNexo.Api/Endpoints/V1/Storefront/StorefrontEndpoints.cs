using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Storefront;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Storefront;
using EcuNexo.Business.Ecommerce.Storefront.Commands.CreateStorefrontOrder;
using EcuNexo.Business.Ecommerce.Storefront.Commands.UploadStorefrontPaymentProof;
using EcuNexo.Business.Ecommerce.Storefront.Queries.GetEcommerceCheckoutOptions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Commands.LikeStorefrontProduct;
using EcuNexo.Business.Storefront.Commands.UnlikeStorefrontProduct;
using EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;
using EcuNexo.Business.Storefront.Queries.ListStorefrontFacets;
using EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;
using EcuNexo.Business.Storefront.Queries.ResolveStorefront;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Storefront;

public static class StorefrontEndpoints
{
    public static WebApplication MapStorefrontEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder storefront = app
            .MapGroup("/api/v{version:apiVersion}/public/tenants/{tenantId:guid}/storefront")
            .WithApiVersionSet(versionSet)
            .WithTags("Storefront")
            .AllowAnonymous();

        storefront.MapGet("/facets", ListFacetsAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Read);
        storefront.MapGet("/products", ListProductsAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Read);
        storefront.MapGet("/products/{productId:guid}", GetProductAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Read);
        storefront.MapPost("/products/{productId:guid}/like", LikeProductAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Likes);
        storefront.MapDelete("/products/{productId:guid}/like", UnlikeProductAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Likes);
        storefront.MapGet("/checkout-options", GetCheckoutOptionsAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Read);
        storefront.MapPost("/orders", CreateOrderAsync)
            .RequireRateLimiting(StorefrontRateLimitPolicies.Orders);
        storefront.MapPost("/orders/{orderId:guid}/payment-proof", UploadPaymentProofAsync)
            .DisableAntiforgery()
            .RequireRateLimiting(StorefrontRateLimitPolicies.Orders);

        RouteGroupBuilder publicStorefront = app
            .MapGroup("/api/v{version:apiVersion}/public/storefront")
            .WithApiVersionSet(versionSet)
            .WithTags("Storefront")
            .AllowAnonymous();

        publicStorefront.MapGet("/resolve", ResolveAsync);

        return app;
    }

    private static async Task<IResult> ResolveAsync(
        string? host,
        HttpContext http,
        ISender sender,
        CancellationToken ct)
    {
        var value = string.IsNullOrWhiteSpace(host) ? http.Request.Host.Host : host;
        var result = await sender
            .AskAsync<ResolveStorefrontQuery, StorefrontResolveResponse>(
                new ResolveStorefrontQuery(value),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        http.Response.Headers.CacheControl = "public,max-age=60";
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> ListFacetsAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListStorefrontFacetsQuery, StorefrontFacetsDto>(
                new ListStorefrontFacetsQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ListProductsAsync(
        Guid tenantId,
        string[]? talla,
        string[]? color,
        string[]? actividad,
        string[]? cana,
        string[]? material,
        string[]? marca,
        string[]? coleccion,
        decimal? priceMin,
        decimal? priceMax,
        bool? inStock,
        bool? @new,
        string? search,
        string? sort,
        int? page,
        int? pageSize,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListStorefrontProductsQuery, StorefrontProductPageDto>(
                new ListStorefrontProductsQuery(
                    tenantId,
                    search,
                    sort,
                    page ?? 1,
                    pageSize ?? 24,
                    BuildFacetFilters(talla, color, actividad, cana, material, marca, coleccion),
                    priceMin,
                    priceMax,
                    inStock ?? false,
                    @new ?? false),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetProductAsync(
        Guid tenantId,
        Guid productId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetStorefrontProductQuery, StorefrontProductDetailDto>(
                new GetStorefrontProductQuery(tenantId, productId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> LikeProductAsync(
        Guid tenantId,
        Guid productId,
        LikeStorefrontProductRequest? body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<LikeStorefrontProductCommand, StorefrontProductLikeDto>(
                new LikeStorefrontProductCommand(tenantId, productId, body?.VisitorId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UnlikeProductAsync(
        Guid tenantId,
        Guid productId,
        string? visitorId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UnlikeStorefrontProductCommand, StorefrontProductLikeDto>(
                new UnlikeStorefrontProductCommand(tenantId, productId, visitorId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetCheckoutOptionsAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetEcommerceCheckoutOptionsQuery, EcommerceCheckoutOptionsDto>(
                new GetEcommerceCheckoutOptionsQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateOrderAsync(
        Guid tenantId,
        CreateStorefrontOrderRequest? body,
        HttpContext http,
        ISender sender,
        CancellationToken ct)
    {
        if (body is null)
        {
            return Results.BadRequest(new { error = "El cuerpo de la solicitud es obligatorio." });
        }

        var result = await sender
            .SendAsync<CreateStorefrontOrderCommand, StorefrontOrderCreatedDto>(
                body.ToCommand(
                    tenantId,
                    StorefrontRateLimitPolicies.ResolveClientIp(http),
                    http.Request.Headers.UserAgent.ToString()),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var created = result.Value!;
        return Results.Created(
            $"/api/v1/public/tenants/{tenantId}/storefront/orders/{created.OrderId}",
            created);
    }

    private static async Task<IResult> UploadPaymentProofAsync(
        Guid tenantId,
        Guid orderId,
        IFormFile? file,
        [FromHeader(Name = "X-Payment-Proof-Token")] string? token,
        ISender sender,
        CancellationToken ct)
    {
        using var stream = file?.OpenReadStream() ?? Stream.Null;
        var command = new UploadStorefrontPaymentProofCommand(
            tenantId,
            orderId,
            token,
            file?.FileName ?? string.Empty,
            file?.ContentType,
            file?.Length ?? 0,
            stream);

        var result = await sender
            .SendAsync<UploadStorefrontPaymentProofCommand, StorefrontPaymentProofUploadedDto>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static Dictionary<string, IReadOnlyList<string>>? BuildFacetFilters(
        string[]? talla,
        string[]? color,
        string[]? actividad,
        string[]? cana,
        string[]? material,
        string[]? marca,
        string[]? coleccion)
    {
        var filters = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);

        AddFilter(filters, "talla", talla);
        AddFilter(filters, "color", color);
        AddFilter(filters, "actividad", actividad);
        AddFilter(filters, "cana", cana);
        AddFilter(filters, "material", material);
        AddFilter(filters, "marca", marca);
        AddFilter(filters, "coleccion", coleccion);

        return filters.Count == 0 ? null : filters;

        static void AddFilter(
            Dictionary<string, IReadOnlyList<string>> target,
            string key,
            string[]? values)
        {
            if (values is not { Length: > 0 })
            {
                return;
            }

            var cleaned = values
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToList();

            if (cleaned.Count > 0)
            {
                target[key] = cleaned;
            }
        }
    }
}
