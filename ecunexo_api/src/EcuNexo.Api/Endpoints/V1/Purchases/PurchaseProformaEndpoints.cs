using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Purchases;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Proformas;
using EcuNexo.Business.Purchases.Proformas.Commands.ApprovePurchaseProforma;
using EcuNexo.Business.Purchases.Proformas.Commands.CreatePurchaseProforma;
using EcuNexo.Business.Purchases.Proformas.Commands.RejectPurchaseProforma;
using EcuNexo.Business.Purchases.Proformas.Queries.GetPurchaseProformaById;
using EcuNexo.Business.Purchases.Proformas.Queries.ListPurchaseProformas;
using EcuNexo.Core.Purchases;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Purchases;

public static class PurchaseProformaEndpoints
{
    public static WebApplication MapPurchaseProformaEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/purchases/proformas")
            .WithApiVersionSet(versionSet)
            .WithTags("Purchases - Proformas")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.proformas.read",
                "purchases.proformas.manage",
                "facturacion.read"));

        group.MapGet("/{proformaId:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.proformas.read",
                "purchases.proformas.manage",
                "facturacion.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.proformas.manage",
                "facturacion.read"));

        group.MapPost("/{proformaId:guid}/approve", ApproveAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.proformas.approve",
                "purchases.proformas.manage",
                "facturacion.read"));

        group.MapPost("/{proformaId:guid}/reject", RejectAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.proformas.manage",
                "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] Guid? supplierId,
        [FromQuery] PurchaseProformaStatus? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListPurchaseProformasQuery, IReadOnlyList<PurchaseProformaResponse>>(
                new ListPurchaseProformasQuery(tenantId, supplierId, status, from, to),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid proformaId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetPurchaseProformaByIdQuery, PurchaseProformaResponse>(
                new GetPurchaseProformaByIdQuery(tenantId, proformaId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreatePurchaseProformaApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var items = request.Items?.Select(i => new CreatePurchaseProformaItemInput(
                i.Description,
                i.Quantity,
                i.UnitPrice,
                i.TaxRate,
                i.CatalogItemId,
                i.ExpenseTypeId))
            .ToList();

        var command = new CreatePurchaseProformaCommand(
            tenantId,
            request.SupplierId,
            request.ProformaNumber,
            request.IssueDate,
            request.ExpirationDate,
            request.Notes,
            request.AttachmentUrl,
            request.AttachmentFileName,
            request.Subtotal,
            request.TaxAmount,
            request.TotalAmount,
            items);

        var result = await sender
            .SendAsync<CreatePurchaseProformaCommand, PurchaseProformaResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Created($"/api/v1/tenants/{tenantId}/purchases/proformas/{result.Value!.Id}", result.Value);
    }

    private static async Task<IResult> ApproveAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid proformaId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ApprovePurchaseProformaCommand, PurchaseProformaResponse>(
                new ApprovePurchaseProformaCommand(tenantId, proformaId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> RejectAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid proformaId,
        [FromBody] RejectPurchaseProformaApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<RejectPurchaseProformaCommand, PurchaseProformaResponse>(
                new RejectPurchaseProformaCommand(tenantId, proformaId, request.Reason),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
