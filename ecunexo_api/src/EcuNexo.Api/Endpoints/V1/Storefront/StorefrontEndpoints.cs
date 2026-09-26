using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;
using EcuNexo.Business.Storefront.Queries.ListStorefrontProducts;
using EcuNexo.Business.Storefront.Queries.ResolveStorefront;

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

        storefront.MapGet("/products", ListProductsAsync);
        storefront.MapGet("/products/{productId:guid}", GetProductAsync);

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

    private static async Task<IResult> ListProductsAsync(
        Guid tenantId,
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
                    pageSize ?? 24),
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
}
