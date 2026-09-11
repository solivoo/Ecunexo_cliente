using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Customers;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Customers;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Customers;

public static class CustomerEndpoints
{
    public static WebApplication MapCustomerEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/customers")
            .WithApiVersionSet(versionSet)
            .WithTags("Customers")
            .RequireAuthorization();

        group.MapGet("/", ListCustomersAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "customers.read",
                "customers.manage",
                "repairs.batches.read",
                "repairs.batches.import",
                "facturacion.read",
                "facturacion.facturas.create",
                "facturacion.comprobantes.read"));

        group.MapGet("/{customerId:guid}", GetCustomerByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "customers.read",
                "customers.manage",
                "repairs.batches.read",
                "facturacion.read",
                "facturacion.facturas.create",
                "facturacion.comprobantes.read"));

        group.MapPost("/", CreateCustomerAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        group.MapPut("/{customerId:guid}", UpdateCustomerAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        group.MapPatch("/{customerId:guid}/status", ToggleCustomerStatusAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        group.MapGet("/{customerId:guid}/repair-rates", GetRepairRatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "customers.read",
                "customers.manage",
                "repairs.batches.read",
                "repairs.batches.import"));

        group.MapPut("/{customerId:guid}/repair-rates", UpsertRepairRatesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "customers.manage",
                "repairs.batches.import"));

        return app;
    }

    private static async Task<IResult> ListCustomersAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] CustomerType? type,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromServices] ICustomerRepository customerRepo,
        CancellationToken ct)
    {
        var customers = await customerRepo.ListAsync(tenantId, type, search, from, to, ct).ConfigureAwait(false);
        return Results.Ok(customers);
    }

    private static async Task<IResult> GetCustomerByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid customerId,
        [FromServices] ICustomerRepository customerRepo,
        CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (customer == null)
        {
            return Results.NotFound(new { message = "Cliente no encontrado." });
        }

        return Results.Ok(customer);
    }

    private static async Task<IResult> CreateCustomerAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateCustomerApiRequest request,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] ICustomerTypeDefinitionRepository typeRepo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "El nombre o razón social del cliente es obligatorio." });
        }

        var typeCheck = await EnsureActiveCustomerTypeAsync(tenantId, request.CustomerType, typeRepo, ct)
            .ConfigureAwait(false);
        if (typeCheck is not null)
        {
            return typeCheck;
        }

        var trimmedName = request.Name.Trim();
        var trimmedTaxId = string.IsNullOrWhiteSpace(request.TaxId) ? null : request.TaxId.Trim();

        if (await customerRepo.ExistsByNameAsync(tenantId, trimmedName, null, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe un cliente registrado con esta razón social." });
        }

        if (trimmedTaxId != null && await customerRepo.ExistsByTaxIdAsync(tenantId, trimmedTaxId, null, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe un cliente registrado con esta identificación fiscal o RUC." });
        }

        var customerResult = Customer.Create(
            Guid.NewGuid(),
            tenantId,
            trimmedName,
            trimmedTaxId,
            request.ContactEmail,
            request.ContactPhone,
            request.Address,
            request.ContactPerson,
            request.Notes,
            request.CustomerType,
            request.IdentificationType);

        if (customerResult.IsFailure)
        {
            return customerResult.ToHttpResult();
        }

        await customerRepo.AddAsync(customerResult.Value!, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Ok(customerResult.Value);
    }

    private static async Task<IResult> UpdateCustomerAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid customerId,
        [FromBody] UpdateCustomerApiRequest request,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] ICustomerTypeDefinitionRepository typeRepo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { error = "El nombre o razón social del cliente es obligatorio." });
        }

        var customer = await customerRepo.GetTrackedByIdAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (customer == null)
        {
            return Results.NotFound(new { message = "Cliente no encontrado." });
        }

        if (request.CustomerType.HasValue)
        {
            var typeCheck = await EnsureActiveCustomerTypeAsync(tenantId, request.CustomerType.Value, typeRepo, ct)
                .ConfigureAwait(false);
            if (typeCheck is not null)
            {
                return typeCheck;
            }
        }

        var trimmedName = request.Name.Trim();
        var trimmedTaxId = string.IsNullOrWhiteSpace(request.TaxId) ? null : request.TaxId.Trim();

        if (await customerRepo.ExistsByNameAsync(tenantId, trimmedName, customerId, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe otro cliente registrado con esta razón social." });
        }

        if (trimmedTaxId != null && await customerRepo.ExistsByTaxIdAsync(tenantId, trimmedTaxId, customerId, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe otro cliente registrado con esta identificación fiscal o RUC." });
        }

        var updateResult = customer.Update(
            trimmedName,
            trimmedTaxId,
            request.ContactEmail,
            request.ContactPhone,
            request.Address,
            request.ContactPerson,
            request.Notes,
            request.CustomerType,
            request.IdentificationType);

        if (updateResult.IsFailure)
        {
            return updateResult.ToHttpResult();
        }

        if (request.IsActive.HasValue)
        {
            if (request.IsActive.Value)
            {
                customer.Activate();
            }
            else
            {
                customer.Deactivate();
            }
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(customer);
    }

    private static async Task<IResult> ToggleCustomerStatusAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid customerId,
        [FromBody] ToggleCustomerStatusApiRequest request,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var customer = await customerRepo.GetTrackedByIdAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (customer == null)
        {
            return Results.NotFound(new { message = "Cliente no encontrado." });
        }

        if (request.IsActive)
        {
            customer.Activate();
        }
        else
        {
            customer.Deactivate();
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(customer);
    }

    private static async Task<IResult> GetRepairRatesAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid customerId,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] ICustomerRepairRateCardRepository rateCardRepo,
        CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (customer is null)
        {
            return Results.NotFound(new { message = "Cliente no encontrado." });
        }

        var card = await rateCardRepo.GetByCustomerAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (card is null)
        {
            return Results.Ok(new CustomerRepairRateCardDto(
                Guid.Empty,
                customerId,
                null,
                null,
                null,
                null,
                null,
                default,
                null));
        }

        return Results.Ok(ToRateCardDto(card));
    }

    private static async Task<IResult> UpsertRepairRatesAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid customerId,
        [FromBody] UpsertCustomerRepairRateCardRequest request,
        [FromServices] ICustomerRepository customerRepo,
        [FromServices] ICustomerRepairRateCardRepository rateCardRepo,
        [FromServices] IUnitOfWork unitOfWork,
        [FromServices] ICallerContext caller,
        CancellationToken ct)
    {
        var customer = await customerRepo.GetByIdAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (customer is null)
        {
            return Results.NotFound(new { message = "Cliente no encontrado." });
        }

        var existing = await rateCardRepo.GetTrackedByCustomerAsync(tenantId, customerId, ct).ConfigureAwait(false);
        if (existing is null)
        {
            var created = CustomerRepairRateCard.Create(
                Guid.NewGuid(),
                tenantId,
                customerId,
                request.RateN1,
                request.RateN2,
                request.RateN3,
                request.ContractReference,
                request.ValidFrom,
                caller.UserId);

            if (created.IsFailure)
            {
                return created.ToHttpResult();
            }

            await rateCardRepo.AddAsync(created.Value!, ct).ConfigureAwait(false);
            await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Results.Ok(ToRateCardDto(created.Value!));
        }

        var updated = existing.UpdateRates(
            request.RateN1,
            request.RateN2,
            request.RateN3,
            request.ContractReference,
            request.ValidFrom,
            caller.UserId);

        if (updated.IsFailure)
        {
            return updated.ToHttpResult();
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(ToRateCardDto(existing));
    }

    private static CustomerRepairRateCardDto ToRateCardDto(CustomerRepairRateCard card) =>
        new(
            card.Id,
            card.CustomerId,
            card.RateN1,
            card.RateN2,
            card.RateN3,
            card.ContractReference,
            card.ValidFrom,
            card.CreatedAt,
            card.UpdatedAt);

    private static async Task<IResult?> EnsureActiveCustomerTypeAsync(
        Guid tenantId,
        CustomerType customerType,
        ICustomerTypeDefinitionRepository typeRepo,
        CancellationToken ct)
    {
        await typeRepo.EnsureSystemDefaultsAsync(tenantId, ct).ConfigureAwait(false);
        var definition = await typeRepo.GetByCodeAsync(tenantId, (int)customerType, ct).ConfigureAwait(false);
        if (definition is null || !definition.IsActive)
        {
            return Results.BadRequest(new { error = "El tipo de cliente no existe o está desactivado." });
        }

        return null;
    }
}
