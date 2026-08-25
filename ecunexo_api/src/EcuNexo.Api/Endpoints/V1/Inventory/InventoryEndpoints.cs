using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Inventory;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Inventory.Commands.ApplyAuthorizedInvoiceEgress;
using EcuNexo.Business.Inventory.Commands.ApproveInventoryDocument;
using EcuNexo.Business.Inventory.Commands.CreateInventoryDocument;
using EcuNexo.Business.Inventory.Commands.ReceiveInventoryTransfer;
using EcuNexo.Business.Inventory.Commands.SetStockMinimum;
using EcuNexo.Business.Inventory.Queries.GetInventoryDocument;
using EcuNexo.Business.Inventory.Queries.ListInventoryDocuments;
using EcuNexo.Business.Inventory.Queries.ListInventoryMovements;
using EcuNexo.Business.Inventory.Queries.ListStock;

namespace EcuNexo.Api.Endpoints.V1.Inventory;

public static class InventoryEndpoints
{
    public static WebApplication MapInventoryEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder stock = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/inventory/stock")
            .WithApiVersionSet(versionSet)
            .WithTags("Inventory")
            .RequireAuthorization();

        stock.MapGet("/", ListStockAsync)
            .AddEndpointFilter(PermissionFilters.Require("inventory.stock.read"));
        stock.MapPut("/{stockId:guid}/minimum", SetStockMinimumAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("inventory.stock.manage", "inventory.documents.approve"));

        RouteGroupBuilder movements = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/inventory/movements")
            .WithApiVersionSet(versionSet)
            .WithTags("Inventory")
            .RequireAuthorization();

        movements.MapGet("/", ListMovementsAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("inventory.movement.read", "inventory.stock.read"));

        RouteGroupBuilder documents = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/inventory/documents")
            .WithApiVersionSet(versionSet)
            .WithTags("Inventory")
            .RequireAuthorization();

        documents.MapPost("/", CreateDocumentAsync)
            .AddEndpointFilter(PermissionFilters.Require("inventory.documents.create"));
        documents.MapGet("/", ListDocumentsAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("inventory.documents.create", "inventory.documents.approve", "inventory.stock.read"));
        documents.MapGet("/{documentId:guid}", GetDocumentAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("inventory.documents.create", "inventory.documents.approve", "inventory.stock.read"));
        documents.MapPost("/{documentId:guid}/approve", ApproveDocumentAsync)
            .AddEndpointFilter(PermissionFilters.Require("inventory.documents.approve"));
        documents.MapPost("/{documentId:guid}/receive", ReceiveTransferAsync)
            .AddEndpointFilter(PermissionFilters.Require("inventory.documents.approve"));

        // Servicio-a-servicio (API key) o JWT con permiso de aprobar.
        RouteGroupBuilder billingEgress = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/inventory/billing-egress")
            .WithApiVersionSet(versionSet)
            .WithTags("Inventory");

        billingEgress.MapPost("/", ApplyBillingEgressAsync)
            .AddEndpointFilter(new InventoryEgressAccessFilter());

        return app;
    }

    private static async Task<IResult> ListStockAsync(
        Guid tenantId,
        Guid? warehouseId,
        bool? belowMinimumOnly,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListStockQuery, IReadOnlyList<StockListItemResponse>>(
                new ListStockQuery(tenantId, warehouseId, belowMinimumOnly == true),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SetStockMinimumAsync(
        Guid tenantId,
        Guid stockId,
        SetStockMinimumRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SetStockMinimumCommand, SetStockMinimumResponse>(
                body.ToCommand(tenantId, stockId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListMovementsAsync(
        Guid tenantId,
        Guid? warehouseId,
        Guid? catalogItemId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListInventoryMovementsQuery, IReadOnlyList<InventoryMovementListItemResponse>>(
                new ListInventoryMovementsQuery(tenantId, warehouseId, catalogItemId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateDocumentAsync(
        Guid tenantId,
        CreateInventoryDocumentRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateInventoryDocumentCommand, CreateInventoryDocumentResponse>(
                body.ToCommand(tenantId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/inventory/documents/{value.DocumentId}",
            value);
    }

    private static async Task<IResult> ListDocumentsAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListInventoryDocumentsQuery, IReadOnlyList<InventoryDocumentListItemResponse>>(
                new ListInventoryDocumentsQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetDocumentAsync(
        Guid tenantId,
        Guid documentId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetInventoryDocumentQuery, InventoryDocumentDetailResponse>(
                new GetInventoryDocumentQuery(tenantId, documentId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ApproveDocumentAsync(
        Guid tenantId,
        Guid documentId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ApproveInventoryDocumentCommand, ApproveInventoryDocumentResponse>(
                new ApproveInventoryDocumentCommand(tenantId, documentId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ReceiveTransferAsync(
        Guid tenantId,
        Guid documentId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ReceiveInventoryTransferCommand, ReceiveInventoryTransferResponse>(
                new ReceiveInventoryTransferCommand(tenantId, documentId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ApplyBillingEgressAsync(
        Guid tenantId,
        ApplyAuthorizedInvoiceEgressRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ApplyAuthorizedInvoiceEgressCommand, ApplyAuthorizedInvoiceEgressResponse>(
                body.ToCommand(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
