using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Ecommerce;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;
using EcuNexo.Business.Ecommerce.Commands.ConfirmEcommerceOrderPayment;
using EcuNexo.Business.Ecommerce.Commands.CreateEcommerceOrder;
using EcuNexo.Business.Ecommerce.Commands.LinkEcommerceOrderInvoice;
using EcuNexo.Business.Ecommerce.Commands.ProcessEcommerceOrder;
using EcuNexo.Business.Ecommerce.Commands.ShipEcommerceOrder;
using EcuNexo.Business.Ecommerce.Dtos;
using EcuNexo.Business.Ecommerce.Queries.GetEcommerceMetrics;
using EcuNexo.Business.Ecommerce.Queries.GetEcommerceOrderById;
using EcuNexo.Business.Ecommerce.Queries.ListEcommerceOrders;
using EcuNexo.Business.Ecommerce.Repositories;
using EcuNexo.Core.Ecommerce;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Ecommerce;

public static class EcommerceOrderEndpoints
{
    public static WebApplication MapEcommerceOrderEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/ecommerce/orders")
            .WithApiVersionSet(versionSet)
            .WithTags("Ecommerce")
            .RequireAuthorization();

        group.MapGet("/", ListOrdersAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.read"));

        group.MapGet("/metrics", GetMetricsAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.read"));

        group.MapGet("/{orderId:guid}", GetOrderByIdAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.read"));

        group.MapPost("/", CreateOrderAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.create"));

        group.MapPost("/{orderId:guid}/confirm-payment", ConfirmPaymentAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.manage"));

        group.MapPost("/{orderId:guid}/process", ProcessOrderAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.manage"));

        group.MapPost("/{orderId:guid}/ship", ShipOrderAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.manage"));

        group.MapPost("/{orderId:guid}/cancel", CancelOrderAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.manage"));

        group.MapPost("/{orderId:guid}/link-invoice", LinkInvoiceAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.orders.manage"));

        return app;
    }

    private static async Task<IResult> ListOrdersAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] EcommerceOrderStatus? status,
        [FromQuery] EcommercePaymentStatus? paymentStatus,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? fromDate,
        [FromQuery] DateTimeOffset? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromServices] ISender sender = default!,
        CancellationToken ct = default)
    {
        var query = new ListEcommerceOrdersQuery(
            tenantId,
            status,
            paymentStatus,
            search,
            fromDate,
            toDate,
            page,
            pageSize);

        var result = await sender
            .AskAsync<ListEcommerceOrdersQuery, ListEcommerceOrdersResponse>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetMetricsAsync(
        [FromRoute] Guid tenantId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var query = new GetEcommerceMetricsQuery(tenantId);
        var result = await sender
            .AskAsync<GetEcommerceMetricsQuery, EcommerceOrderMetrics>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetOrderByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var query = new GetEcommerceOrderByIdQuery(tenantId, orderId);
        var result = await sender
            .AskAsync<GetEcommerceOrderByIdQuery, EcommerceOrderDetailDto>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateOrderAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateEcommerceOrderRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new CreateEcommerceOrderCommand(
            TenantId: tenantId,
            WarehouseId: request.WarehouseId,
            PaymentMethod: request.PaymentMethod,
            ShippingMethod: request.ShippingMethod,
            Customer: request.Customer,
            Shipping: request.Shipping,
            Items: request.Items.Select(i => i.ToInput()).ToList(),
            ShippingCost: request.ShippingCost,
            InternalNotes: request.InternalNotes,
            CustomerNotes: request.CustomerNotes,
            CreatedBy: caller.UserId,
            CreatedByName: caller.UserId?.ToString());

        var result = await sender
            .SendAsync<CreateEcommerceOrderCommand, CreateEcommerceOrderResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ConfirmPaymentAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromBody] ConfirmEcommercePaymentRequest? request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new ConfirmEcommerceOrderPaymentCommand(
            tenantId,
            orderId,
            request?.PaymentReference,
            caller.UserId,
            caller.UserId?.ToString());

        var result = await sender
            .SendAsync<ConfirmEcommerceOrderPaymentCommand, ConfirmEcommerceOrderPaymentResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ProcessOrderAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new ProcessEcommerceOrderCommand(
            tenantId,
            orderId,
            caller.UserId,
            caller.UserId?.ToString());

        var result = await sender
            .SendAsync<ProcessEcommerceOrderCommand, ProcessEcommerceOrderResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ShipOrderAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromBody] ShipEcommerceOrderRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new ShipEcommerceOrderCommand(
            tenantId,
            orderId,
            request.Carrier,
            request.TrackingNumber,
            caller.UserId,
            caller.UserId?.ToString());

        var result = await sender
            .SendAsync<ShipEcommerceOrderCommand, ShipEcommerceOrderResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CancelOrderAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromBody] CancelEcommerceOrderRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new CancelEcommerceOrderCommand(
            tenantId,
            orderId,
            request.Reason,
            caller.UserId,
            caller.UserId?.ToString());

        var result = await sender
            .SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> LinkInvoiceAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid orderId,
        [FromBody] LinkEcommerceInvoiceRequest request,
        [FromServices] ISender sender,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var command = new LinkEcommerceOrderInvoiceCommand(
            tenantId,
            orderId,
            request.BillingInvoiceId,
            caller.UserId);

        var result = await sender
            .SendAsync<LinkEcommerceOrderInvoiceCommand, LinkEcommerceOrderInvoiceResponse>(command, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
