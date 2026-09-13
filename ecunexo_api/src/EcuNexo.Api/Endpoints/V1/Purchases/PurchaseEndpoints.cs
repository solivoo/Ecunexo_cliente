using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Purchases;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Commands.CreatePurchase;
using EcuNexo.Business.Purchases.Commands.ParseSriPurchaseXml;
using EcuNexo.Business.Purchases.Commands.ReceivePurchase;
using EcuNexo.Business.Purchases.Queries.GetPurchaseById;
using EcuNexo.Business.Purchases.Queries.ListPurchases;
using EcuNexo.Core.Purchases;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Purchases;

public static class PurchaseEndpoints
{
    public static WebApplication MapPurchaseEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/purchases/documents")
            .WithApiVersionSet(versionSet)
            .WithTags("Purchases - Documents")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.documents.read",
                "purchases.documents.manage",
                "purchases.read",
                "facturacion.read"));

        group.MapGet("/{purchaseId:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.documents.read",
                "purchases.documents.manage",
                "purchases.read",
                "facturacion.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.documents.manage",
                "purchases.manage",
                "facturacion.read"));

        group.MapPost("/parse-xml", ParseXmlAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.documents.manage",
                "purchases.manage",
                "facturacion.read"));

        group.MapPost("/{purchaseId:guid}/receive", ReceiveAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.documents.manage",
                "purchases.manage",
                "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] Guid? supplierId,
        [FromQuery] PurchaseStatus? status,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? search,
        [FromServices] IQueryHandler<ListPurchasesQuery, ListPurchasesResponse> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new ListPurchasesQuery(tenantId, supplierId, status, from, to, search), ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid purchaseId,
        [FromServices] IQueryHandler<GetPurchaseByIdQuery, PurchaseDetailDto> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new GetPurchaseByIdQuery(tenantId, purchaseId), ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ParseXmlAsync(
        [FromRoute] Guid tenantId,
        [FromBody] ParseSriPurchaseXmlApiRequest request,
        [FromServices] ICommandHandler<ParseSriPurchaseXmlCommand, ParseSriPurchaseXmlResponse> handler,
        CancellationToken ct)
    {
        var result = await handler.Handle(new ParseSriPurchaseXmlCommand(tenantId, request.XmlContent), ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreatePurchaseApiRequest request,
        [FromServices] ICommandHandler<CreatePurchaseCommand, CreatePurchaseResponse> handler,
        [FromServices] ICallerContext callerContext,
        CancellationToken ct)
    {
        var userId = callerContext.UserId ?? Guid.Empty;
        var lines = request.Items?.Select(i => new CreatePurchaseLineInput(
            Description: i.Description,
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice,
            Discount: i.Discount,
            TaxRate: i.TaxRate,
            ItemCode: i.ItemCode,
            CatalogItemId: i.CatalogItemId,
            WarehouseId: i.WarehouseId,
            AffectsInventory: i.AffectsInventory
        )).ToList();

        var cmd = new CreatePurchaseCommand(
            TenantId: tenantId,
            SupplierId: request.SupplierId,
            InvoiceNumber: request.InvoiceNumber,
            IssueDate: request.IssueDate,
            DocumentType: request.DocumentType,
            AuthorizationNumber: request.AuthorizationNumber,
            ExpenseTypeId: request.ExpenseTypeId,
            SriSustentoCode: request.SriSustentoCode,
            SubtotalZero: request.SubtotalZero,
            SubtotalTaxed: request.SubtotalTaxed,
            SubtotalNoSubject: request.SubtotalNoSubject,
            SubtotalExempt: request.SubtotalExempt,
            TaxRate: request.TaxRate,
            TaxAmount: request.TaxAmount,
            TotalDiscount: request.TotalDiscount,
            TotalAmount: request.TotalAmount,
            PaymentMethodCode: request.PaymentMethodCode,
            CreditDays: request.CreditDays,
            ProformaId: request.ProformaId,
            RawXml: request.RawXml,
            Notes: request.Notes,
            Lines: lines,
            CreatedBy: userId
        );

        var result = await handler.Handle(cmd, ct);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ReceiveAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid purchaseId,
        [FromBody] ReceivePurchaseApiRequest request,
        [FromServices] ICommandHandler<ReceivePurchaseCommand, ReceivePurchaseResponse> handler,
        [FromServices] ICallerContext callerContext,
        CancellationToken ct)
    {
        var userId = callerContext.UserId ?? Guid.Empty;
        var lineMappings = request.LineMappings?.Select(m => new PurchaseLineWarehouseMapping(
            LineId: m.LineId,
            CatalogItemId: m.CatalogItemId,
            WarehouseId: m.WarehouseId
        )).ToList();

        var cmd = new ReceivePurchaseCommand(
            TenantId: tenantId,
            PurchaseId: purchaseId,
            DefaultWarehouseId: request.DefaultWarehouseId,
            LineMappings: lineMappings,
            UserId: userId
        );

        var result = await handler.Handle(cmd, ct);
        return result.ToHttpResult();
    }
}
