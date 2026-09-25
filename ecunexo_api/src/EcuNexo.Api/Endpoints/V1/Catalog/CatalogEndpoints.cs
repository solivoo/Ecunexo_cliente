using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Catalog;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Business.Catalog.Commands.CreateCatalogItem;
using EcuNexo.Business.Catalog.Commands.CreateCatalogItemMatrix;
using EcuNexo.Business.Catalog.Commands.AddCatalogItemVariant;
using EcuNexo.Business.Catalog.Commands.CreateCategory;
using EcuNexo.Business.Catalog.Commands.CreateProductTemplate;
using EcuNexo.Business.Catalog.Commands.CreateVariantDimensionTemplate;
using EcuNexo.Business.Catalog.Commands.DeleteCatalogItemImage;
using EcuNexo.Business.Catalog.Commands.DeleteProductTemplate;
using EcuNexo.Business.Catalog.Commands.DeleteVariantDimensionTemplate;
using EcuNexo.Business.Catalog.Commands.ReassignCatalogItemVariantParent;
using EcuNexo.Business.Catalog.Commands.ReorderCatalogItemImages;
using EcuNexo.Business.Catalog.Commands.SetCatalogItemMainImage;
using EcuNexo.Business.Catalog.Commands.SoftDeleteCatalogItem;
using EcuNexo.Business.Catalog.Commands.SoftDeleteCategory;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItem;
using EcuNexo.Business.Catalog.Commands.UpdateCatalogItemImageAltText;
using EcuNexo.Business.Catalog.Commands.UpdateCategory;
using EcuNexo.Business.Catalog.Commands.UpdateProductTemplate;
using EcuNexo.Business.Catalog.Commands.UpdateVariantDimensionTemplate;
using EcuNexo.Business.Catalog.Commands.UploadCatalogItemImage;
using EcuNexo.Business.Catalog.Queries.GetCatalogItem;
using EcuNexo.Business.Catalog.Queries.GetProductTemplateById;
using EcuNexo.Business.Catalog.Queries.ListCatalogItems;
using EcuNexo.Business.Catalog.Queries.ListCategories;
using EcuNexo.Business.Catalog.Queries.ListProductTemplates;
using EcuNexo.Business.Catalog.Queries.ListVariantDimensionTemplates;
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
                PermissionFilters.RequireAny("catalog.item.read", "catalog.category.manage"));

        RouteGroupBuilder items = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/items")
            .WithApiVersionSet(versionSet)
            .WithTags("Catalog")
            .RequireAuthorization();

        items.MapPost("/", CreateItemAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        items.MapPost("/matrix", CreateItemMatrixAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("catalog.item.create", "catalog.matrix.create"));
        items.MapPost("/{itemId:guid}/variants", AddItemVariantAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "catalog.item.create",
                    "catalog.item.update",
                    "catalog.matrix.create",
                    "catalog.matrix.update"));
        items.MapPost("/{itemId:guid}/reassign-parent", ReassignItemVariantParentAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.update"));
        items.MapGet("/", ListItemsAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("catalog.item.read", "catalog.matrix.read"));
        items.MapGet("/{itemId:guid}", GetItemAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("catalog.item.read", "catalog.matrix.read"));
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

        RouteGroupBuilder variantTemplates = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/variant-templates")
            .WithApiVersionSet(versionSet)
            .WithTags("Catalog")
            .RequireAuthorization();

        variantTemplates.MapGet("/", ListVariantTemplatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("catalog.item.read", "catalog.item.create"));
        variantTemplates.MapPost("/", CreateVariantTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        variantTemplates.MapPut("/{templateId:guid}", UpdateVariantTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        variantTemplates.MapDelete("/{templateId:guid}", DeleteVariantTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));

        RouteGroupBuilder productTemplates = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/catalog/product-templates")
            .WithApiVersionSet(versionSet)
            .WithTags("Catalog")
            .RequireAuthorization();

        productTemplates.MapGet("/", ListProductTemplatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("catalog.item.read", "catalog.item.create"));
        productTemplates.MapGet("/{templateId:guid}", GetProductTemplateByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("catalog.item.read", "catalog.item.create"));
        productTemplates.MapPost("/", CreateProductTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        productTemplates.MapPut("/{templateId:guid}", UpdateProductTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));
        productTemplates.MapDelete("/{templateId:guid}", DeleteProductTemplateAsync)
            .AddEndpointFilter(PermissionFilters.Require("catalog.item.create"));

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

    private static async Task<IResult> CreateItemMatrixAsync(
        Guid tenantId,
        CreateCatalogItemMatrixRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var variants = body.Variants.Select(v => new CreateVariantChildDto(
            v.VariantTitle,
            v.Sku,
            v.Barcode,
            v.BasePrice,
            v.CustomAttributesJson,
            v.InitialStock,
            v.InitialStockWarehouseId)).ToList();

        var command = new CreateCatalogItemMatrixCommand(
            tenantId,
            (CatalogItemKind)body.Kind,
            body.Name,
            body.Description,
            body.ModelCode,
            body.BasePrice,
            body.CategoryId,
            body.VariantDimensionsJson,
            variants,
            body.CustomAttributesJson,
            body.FamilyId,
            body.HierarchyPathJson);

        var result = await sender
            .SendAsync<CreateCatalogItemMatrixCommand, CreateCatalogItemMatrixResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{tenantId}/catalog/items/{value.ParentItemId}",
            value);
    }

    private static async Task<IResult> AddItemVariantAsync(
        Guid tenantId,
        Guid itemId,
        AddCatalogItemVariantRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var command = new AddCatalogItemVariantCommand(
            tenantId,
            itemId,
            body.VariantTitle,
            body.Sku,
            body.BasePrice,
            body.CustomAttributesJson,
            body.InitialStock,
            body.InitialStockWarehouseId);

        var result = await sender
            .SendAsync<AddCatalogItemVariantCommand, AddCatalogItemVariantResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{tenantId}/catalog/items/{value.VariantItemId}",
            value);
    }

    private static async Task<IResult> ReassignItemVariantParentAsync(
        Guid tenantId,
        Guid itemId,
        ReassignCatalogItemVariantParentRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new ReassignCatalogItemVariantParentCommand(
            tenantId,
            itemId,
            body.TargetParentItemId,
            body.Reason,
            caller.UserId);

        var result = await sender
            .SendAsync<ReassignCatalogItemVariantParentCommand, ReassignCatalogItemVariantParentResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ListItemsAsync(
        Guid tenantId,
        CatalogItemKind? kind,
        CatalogItemStatus? status,
        bool? onlyRoots,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListCatalogItemsQuery, IReadOnlyList<CatalogItemListItemResponse>>(
                new ListCatalogItemsQuery(tenantId, kind, status, onlyRoots ?? false),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListVariantTemplatesAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListVariantDimensionTemplatesQuery, IReadOnlyList<VariantDimensionTemplateResponse>>(
                new ListVariantDimensionTemplatesQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateVariantTemplateAsync(
        Guid tenantId,
        CreateVariantDimensionTemplateRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var command = new CreateVariantDimensionTemplateCommand(
            tenantId,
            body.Name,
            body.DimensionType,
            body.PredefinedValuesJson ?? "[]",
            body.DataType,
            body.IsVariantAxis,
            body.Unit);

        var result = await sender
            .SendAsync<CreateVariantDimensionTemplateCommand, CreateVariantDimensionTemplateResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateVariantTemplateAsync(
        Guid tenantId,
        Guid templateId,
        UpdateVariantDimensionTemplateRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var command = new UpdateVariantDimensionTemplateCommand(
            templateId,
            tenantId,
            body.Name,
            body.DimensionType,
            body.PredefinedValuesJson ?? "[]",
            body.DataType,
            body.IsVariantAxis,
            body.Unit);

        var result = await sender
            .SendAsync<UpdateVariantDimensionTemplateCommand, UpdateVariantDimensionTemplateResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteVariantTemplateAsync(
        Guid tenantId,
        Guid templateId,
        ISender sender,
        CancellationToken ct)
    {
        var command = new DeleteVariantDimensionTemplateCommand(templateId, tenantId);

        var result = await sender
            .SendAsync<DeleteVariantDimensionTemplateCommand, DeleteVariantDimensionTemplateResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> ListProductTemplatesAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListProductTemplatesQuery, IReadOnlyList<ProductTemplateResponse>>(
                new ListProductTemplatesQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetProductTemplateByIdAsync(
        Guid tenantId,
        Guid templateId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetProductTemplateByIdQuery, ProductTemplateResponse>(
                new GetProductTemplateByIdQuery(templateId, tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateProductTemplateAsync(
        Guid tenantId,
        CreateProductTemplateRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new CreateProductTemplateCommand(
            tenantId,
            body.Name,
            body.Description,
            body.HierarchyTreeJson,
            body.IsActive,
            caller.UserId);

        var result = await sender
            .SendAsync<CreateProductTemplateCommand, CreateProductTemplateResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateProductTemplateAsync(
        Guid tenantId,
        Guid templateId,
        UpdateProductTemplateRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var command = new UpdateProductTemplateCommand(
            templateId,
            tenantId,
            body.Name,
            body.Description,
            body.HierarchyTreeJson,
            body.IsActive,
            caller.UserId);

        var result = await sender
            .SendAsync<UpdateProductTemplateCommand, UpdateProductTemplateResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteProductTemplateAsync(
        Guid tenantId,
        Guid templateId,
        ISender sender,
        CancellationToken ct)
    {
        var command = new DeleteProductTemplateCommand(templateId, tenantId);

        var result = await sender
            .SendAsync<DeleteProductTemplateCommand, DeleteProductTemplateResponse>(command, ct)
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
        [FromForm] string? groupValue,
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
            UserId: caller.UserId,
            GroupValue: groupValue);

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
