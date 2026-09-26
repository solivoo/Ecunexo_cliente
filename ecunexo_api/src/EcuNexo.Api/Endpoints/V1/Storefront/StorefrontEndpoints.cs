using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Queries.GetStorefrontProduct;
using EcuNexo.Business.Storefront.Queries.ListStorefrontFacets;
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

        storefront.MapGet("/facets", ListFacetsAsync);
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
