using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Purchases;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Suppliers;
using EcuNexo.Business.Purchases.Suppliers.Commands.CreateSupplier;
using EcuNexo.Business.Purchases.Suppliers.Commands.DeleteSupplier;
using EcuNexo.Business.Purchases.Suppliers.Commands.UpdateSupplier;
using EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierById;
using EcuNexo.Business.Purchases.Suppliers.Queries.GetSupplierByTaxId;
using EcuNexo.Business.Purchases.Suppliers.Queries.ListSuppliers;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Purchases;

public static class SupplierEndpoints
{
    public static WebApplication MapSupplierEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/purchases/suppliers")
            .WithApiVersionSet(versionSet)
            .WithTags("Purchases - Suppliers")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.suppliers.read",
                "purchases.suppliers.manage",
                "purchases.documents.manage",
                "inventory.documents.create"));

        group.MapGet("/{supplierId:guid}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.suppliers.read",
                "purchases.suppliers.manage"));

        group.MapGet("/by-tax-id/{taxId}", GetByTaxIdAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.suppliers.read",
                "purchases.suppliers.manage",
                "purchases.documents.manage",
                "inventory.documents.create"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.Require(
                "purchases.suppliers.manage"));

        group.MapPut("/{supplierId:guid}", UpdateAsync)
            .AddEndpointFilter(PermissionFilters.Require(
                "purchases.suppliers.manage"));

        group.MapDelete("/{supplierId:guid}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.Require(
                "purchases.suppliers.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] string? search,
        [FromQuery] bool? activeOnly,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListSuppliersQuery, IReadOnlyList<SupplierResponse>>(
                new ListSuppliersQuery(tenantId, search, activeOnly),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid supplierId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetSupplierByIdQuery, SupplierResponse>(
                new GetSupplierByIdQuery(tenantId, supplierId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> GetByTaxIdAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] string taxId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetSupplierByTaxIdQuery, SupplierResponse?>(
                new GetSupplierByTaxIdQuery(tenantId, taxId),
                ct)
            .ConfigureAwait(false);

        if (result.IsFailure)
        {
            return result.ToHttpResult();
        }

        return result.Value is not null
            ? Results.Ok(result.Value)
            : Results.NotFound();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateSupplierApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new CreateSupplierCommand(
            tenantId,
            request.BusinessName,
            request.TaxId,
            request.IdentificationType,
            request.TaxRegime,
            request.TradeName,
            request.IsRetentionAgent,
            request.ResolutionNumber,
            request.ContactEmail,
            request.ContactPhone,
            request.Address,
            request.ContactPerson,
            request.CreditDays,
            request.CreditLimit,
            request.BankName,
            request.BankAccountType,
            request.BankAccountNumber,
            request.Notes,
            ReturnExistingIfExists: request.ReturnExistingIfExists);

        var result = await sender
            .SendAsync<CreateSupplierCommand, SupplierResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Created($"/api/v1/tenants/{tenantId}/purchases/suppliers/{result.Value!.Id}", result.Value);
    }

    private static async Task<IResult> UpdateAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid supplierId,
        [FromBody] UpdateSupplierApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new UpdateSupplierCommand(
            tenantId,
            supplierId,
            request.BusinessName,
            request.TaxId,
            request.IdentificationType,
            request.TaxRegime,
            request.TradeName,
            request.IsRetentionAgent,
            request.ResolutionNumber,
            request.ContactEmail,
            request.ContactPhone,
            request.Address,
            request.ContactPerson,
            request.CreditDays,
            request.CreditLimit,
            request.BankName,
            request.BankAccountType,
            request.BankAccountNumber,
            request.Notes,
            request.IsActive);

        var result = await sender
            .SendAsync<UpdateSupplierCommand, SupplierResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid supplierId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeleteSupplierCommand, bool>(new DeleteSupplierCommand(tenantId, supplierId), ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
