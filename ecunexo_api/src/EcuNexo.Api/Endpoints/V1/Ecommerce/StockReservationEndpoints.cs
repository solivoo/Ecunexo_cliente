using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Reservations;
using EcuNexo.Business.Ecommerce.Reservations.AddStockReservationPayment;
using EcuNexo.Business.Ecommerce.Reservations.CancelStockReservation;
using EcuNexo.Business.Ecommerce.Reservations.CreateStockReservation;
using EcuNexo.Business.Ecommerce.Reservations.GetStockReservationById;
using EcuNexo.Business.Ecommerce.Reservations.GetStockReservationPaymentProofUrl;
using EcuNexo.Business.Ecommerce.Reservations.InvoiceStockReservation;
using EcuNexo.Business.Ecommerce.Reservations.ListStockReservations;
using EcuNexo.Core.Customers;
using EcuNexo.Core.Ecommerce;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Ecommerce;

public static class StockReservationEndpoints
{
    public static WebApplication MapStockReservationEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/ecommerce/reservations")
            .WithApiVersionSet(versionSet)
            .WithTags("Ecommerce Reservations")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "inventory.stock.read"));

        group.MapGet("/{reservationId:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "inventory.stock.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "inventory.documents.create"));

        group.MapPost("/{reservationId:guid}/payments", AddPaymentAsync)
            .DisableAntiforgery()
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage"));

        group.MapGet("/{reservationId:guid}/payments/{paymentId:guid}/proof-url", GetProofUrlAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read"));

        group.MapPost("/{reservationId:guid}/cancel", CancelAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage"));

        group.MapPost("/{reservationId:guid}/invoice", InvoiceAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "facturacion.facturas.create"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        Guid tenantId,
        StockReservationStatus? status,
        string? search,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListStockReservationsQuery, IReadOnlyList<StockReservationDto>>(
                new ListStockReservationsQuery(tenantId, status, search),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        Guid tenantId,
        Guid reservationId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetStockReservationByIdQuery, StockReservationDto>(
                new GetStockReservationByIdQuery(tenantId, reservationId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        Guid tenantId,
        CreateStockReservationRequest body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        var newCustomer = body.NewCustomer is null
            ? null
            : new CreateReservationCustomerInput(
                body.NewCustomer.Name,
                body.NewCustomer.TaxId,
                body.NewCustomer.Email,
                body.NewCustomer.Phone,
                body.NewCustomer.Address,
                body.NewCustomer.IdentificationType ?? CustomerIdentificationType.Cedula);

        var items = body.Items
            .Select(i => new CreateReservationItemInput(i.CatalogItemId, i.Quantity, i.UnitPrice, i.TaxRate))
            .ToList();

        var result = await sender
            .SendAsync<CreateStockReservationCommand, StockReservationDto>(
                new CreateStockReservationCommand(
                    tenantId,
                    body.WarehouseId,
                    body.CustomerId,
                    newCustomer,
                    items,
                    body.ExpiresAtUtc,
                    body.Notes,
                    caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> AddPaymentAsync(
        Guid tenantId,
        Guid reservationId,
        [FromForm] decimal amount,
        [FromForm] EcommercePaymentMethod paymentMethod,
        [FromForm] string? reference,
        [FromForm] string? notes,
        IFormFile? file,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        await using Stream? stream = file?.OpenReadStream();
        var result = await sender
            .SendAsync<AddStockReservationPaymentCommand, StockReservationDto>(
                new AddStockReservationPaymentCommand(
                    tenantId,
                    reservationId,
                    amount,
                    paymentMethod,
                    reference,
                    notes,
                    file?.FileName,
                    file?.ContentType,
                    file?.Length ?? 0,
                    stream,
                    caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetProofUrlAsync(
        Guid tenantId,
        Guid reservationId,
        Guid paymentId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetStockReservationPaymentProofUrlQuery, StockReservationPaymentProofUrlDto>(
                new GetStockReservationPaymentProofUrlQuery(tenantId, reservationId, paymentId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CancelAsync(
        Guid tenantId,
        Guid reservationId,
        CancelStockReservationRequest? body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CancelStockReservationCommand, StockReservationDto>(
                new CancelStockReservationCommand(tenantId, reservationId, body?.Reason, caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> InvoiceAsync(
        Guid tenantId,
        Guid reservationId,
        InvoiceStockReservationRequest body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<InvoiceStockReservationCommand, StockReservationDto>(
                new InvoiceStockReservationCommand(
                    tenantId,
                    reservationId,
                    body.BillingInvoiceId,
                    body.Observation,
                    caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}

public sealed record CreateReservationCustomerRequest(
    string Name,
    string? TaxId,
    string? Email,
    string? Phone,
    string? Address,
    CustomerIdentificationType? IdentificationType = null);

public sealed record CreateReservationItemRequest(
    Guid CatalogItemId,
    decimal Quantity,
    decimal? UnitPrice = null,
    decimal? TaxRate = null);

public sealed record CreateStockReservationRequest(
    Guid WarehouseId,
    Guid? CustomerId,
    CreateReservationCustomerRequest? NewCustomer,
    IReadOnlyList<CreateReservationItemRequest> Items,
    DateTimeOffset? ExpiresAtUtc = null,
    string? Notes = null);

public sealed record CancelStockReservationRequest(string? Reason = null);

public sealed record InvoiceStockReservationRequest(Guid BillingInvoiceId, string? Observation = null);
