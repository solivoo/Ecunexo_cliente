using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Catalog;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.CreateCatalogItem;
using EcuNexo.Business.Catalog.Commands.CreateCategory;
using EcuNexo.Business.Catalog.Commands.DeleteCatalogItemImage;
using EcuNexo.Business.Catalog.Commands.ReorderCatalogItemImages;
using EcuNexo.Business.Catalog.Commands.SetCatalogItemMainImage;
using EcuNexo.Business.Catalog.Commands.SoftDeleteCatalogItem;
using EcuNexo.Business.Catalog.Commands.SoftDeleteCategory;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItemImageAltText;
using EcuNexo.Business.Catalog.Commands.UpdateCategory;
using EcuNexo.Business.Catalog.Commands.UploadCatalogItemImage;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Business.Catalog.Queries.ListCatalogItems;
using EcuNexo.Business.Catalog.Queries.ListCategories;
using EcuNexo.Core.Catalog;
using Microsoft.AspNetCore.Mvc;

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
        categories.MapDelete("/{categoryId:guid}", SoftDeleteCategoryAsync)
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
        items.MapDelete("/{itemId:guid}", SoftDeleteItemAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.delete"));

        items.MapPost("/{itemId:guid}/images", UploadItemImageAsync)
            .DisableAntiforgery()
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));
        items.MapDelete("/{itemId:guid}/images/{imageId:guid}", DeleteItemImageAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));
        items.MapPut("/{itemId:guid}/images/{imageId:guid}/main", SetMainImageAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));
        items.MapPut("/{itemId:guid}/images/reorder", ReorderImagesAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));
        items.MapPut("/{itemId:guid}/images/{imageId:guid}/alt-text", UpdateImageAltTextAsync)
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

    private static async Task<IResult> SoftDeleteCategoryAsync(
        Guid tenantId,
        Guid categoryId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SoftDeleteCategoryCommand, SoftDeleteCategoryResponse>(
                new SoftDeleteCategoryCommand(tenantId, categoryId),
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
        CatalogItemStatus? status,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>(
                new ListCatalogItemsQuery(tenantId, kind, status),
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

    private static async Task<IResult> SoftDeleteItemAsync(
        Guid tenantId,
        Guid itemId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SoftDeleteCatalogItemCommand, SoftDeleteCatalogItemResponse>(
                new SoftDeleteCatalogItemCommand(tenantId, itemId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UploadItemImageAsync(
        Guid tenantId,
        Guid itemId,
        IFormFile? file,
        [FromForm] string? altText,
        [FromForm] bool? setAsMain,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return Results.BadRequest(new { code = "catalog.item.image.required", message = "Debe proporcionar un archivo de imagen." });
        }

        using var stream = file.OpenReadStream();
        var command = new UploadCatalogItemImageCommand(
            TenantId: tenantId,
            ItemId: itemId,
            FileStream: stream,
            FileName: file.FileName,
            ContentType: file.ContentType,
            AltText: altText,
            SetAsMain: setAsMain,
            UserId: caller.UserId);

        var result = await sender.SendAsync<UploadCatalogItemImageCommand, CatalogItemImageResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteItemImageAsync(
        Guid tenantId,
        Guid itemId,
        Guid imageId,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new DeleteCatalogItemImageCommand(tenantId, itemId, imageId, caller.UserId);
        var result = await sender.SendAsync<DeleteCatalogItemImageCommand, DeleteCatalogItemImageResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SetMainImageAsync(
        Guid tenantId,
        Guid itemId,
        Guid imageId,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new SetCatalogItemMainImageCommand(tenantId, itemId, imageId, caller.UserId);
        var result = await sender.SendAsync<SetCatalogItemMainImageCommand, SetCatalogItemMainImageResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ReorderImagesAsync(
        Guid tenantId,
        Guid itemId,
        ReorderCatalogItemImagesRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new ReorderCatalogItemImagesCommand(tenantId, itemId, body.ImageIds, caller.UserId);
        var result = await sender.SendAsync<ReorderCatalogItemImagesCommand, ReorderCatalogItemImagesResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateImageAltTextAsync(
        Guid tenantId,
        Guid itemId,
        Guid imageId,
        UpdateCatalogItemImageAltTextRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new UpdateCatalogItemImageAltTextCommand(tenantId, itemId, imageId, body.AltText, caller.UserId);
        var result = await sender.SendAsync<UpdateCatalogItemImageAltTextCommand, UpdateCatalogItemImageAltTextResponse>(command, ct).ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
