using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Catalog;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog.Commands.CreateCatalogItem;
using EcuNexo.Business.Catalog.Commands.CreateCategory;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;
using EcuNexo.Business.Catalog.Commands.UpdateCategory;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Business.Catalog.Queries.ListCatalogItems;
using EcuNexo.Business.Catalog.Queries.ListCategories;
using EcuNexo.Core.Catalog;

namespace EcuNexo.Api.Endpoints.V1.Catalog;

public static class CatalogEndpoints
{
    public static WebApplication MapCatalogEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder categories = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/categories")
            .WithApiVersionSet(versionSet)
            .WithTags("Catalog")
            .RequireAuthorization();

        categories.MapPost("/", CreateCategoryAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.category.manage"));
        categories.MapPut("/{categoryId:guid}", UpdateCategoryAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.category.manage"));
        categories.MapGet("/", ListCategoriesAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("catalog.item.read", "catalog.category.manage", "catalog.product.read"));

        RouteGroupBuilder items = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/items")
            .WithApiVersionSet(versionSet)
            .WithTags("Catalog")
            .RequireAuthorization();

        items.MapPost("/", CreateItemAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        items.MapGet("/", ListItemsAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("catalog.item.read", "catalog.product.read"));
        items.MapGet("/{itemId:guid}", GetItemAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("catalog.item.read", "catalog.product.read"));
        items.MapPut("/{itemId:guid}", UpdateItemAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));

        return app;
    }

    private static async Task<IResult> CreateCategoryAsync(
        Guid tenantId,
        CreateCategoryRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateCategoryCommand, CreateCategoryResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/catalog/categories/{value.CategoryId}",
            value);
    }

    private static async Task<IResult> ListCategoriesAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListCategoriesQuery, IReadOnlyList<CategoryListItemResponse>>(
                new ListCategoriesQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateCategoryAsync(
        Guid tenantId,
        Guid categoryId,
        UpdateCategoryRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateCategoryCommand, UpdateCategoryResponse>(
                body.ToCommand(tenantId, categoryId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateItemAsync(
        Guid tenantId,
        CreateCatalogItemRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateCatalogItemCommand, CreateCatalogItemResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/catalog/items/{value.ItemId}",
            value);
    }

    private static async Task<IResult> ListItemsAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>(
                new ListCatalogItemsQuery(tenantId, kind),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetItemAsync(
        Guid tenantId,
        Guid itemId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetCatalogItemQuery, CatalogItemDetailResponse>(
                new GetCatalogItemQuery(tenantId, itemId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateItemAsync(
        Guid tenantId,
        Guid itemId,
        UpdateCatalogItemRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateCatalogItemCommand, UpdateCatalogItemResponse>(
                body.ToCommand(tenantId, itemId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
