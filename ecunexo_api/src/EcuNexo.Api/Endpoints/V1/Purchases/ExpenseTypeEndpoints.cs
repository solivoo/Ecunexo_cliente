using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Purchases;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Expenses;
using EcuNexo.Business.Purchases.Expenses.Commands.CreateExpenseType;
using EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType;
using EcuNexo.Business.Purchases.Expenses.Commands.SeedDefaultExpenseTypes;
using EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType;
using EcuNexo.Business.Purchases.Expenses.Queries.ListExpenseTypes;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Purchases;

public static class ExpenseTypeEndpoints
{
    public static WebApplication MapExpenseTypeEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/purchases/expense-types")
            .WithApiVersionSet(versionSet)
            .WithTags("Purchases - Expense Types")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.expenses.read",
                "purchases.expenses.manage",
                "facturacion.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.expenses.manage",
                "facturacion.read"));

        group.MapPut("/{id:guid}", UpdateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.expenses.manage",
                "facturacion.read"));

        group.MapDelete("/{id:guid}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.expenses.manage",
                "facturacion.read"));

        group.MapPost("/seed", SeedDefaultsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "purchases.expenses.manage",
                "facturacion.read"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] bool? activeOnly,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListExpenseTypesQuery, IReadOnlyList<ExpenseTypeResponse>>(
                new ListExpenseTypesQuery(tenantId, activeOnly),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateExpenseTypeApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new CreateExpenseTypeCommand(
            tenantId,
            request.Code,
            request.Name,
            request.SriSustentoCode,
            request.AffectsInventory,
            request.SuggestedRetentionCode,
            request.RetentionPercentage,
            request.ValidFrom,
            request.ValidUntil,
            request.Description);

        var result = await sender
            .SendAsync<CreateExpenseTypeCommand, ExpenseTypeResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Created($"/api/v1/tenants/{tenantId}/purchases/expense-types/{result.Value!.Id}", result.Value);
    }

    private static async Task<IResult> UpdateAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromBody] UpdateExpenseTypeApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new UpdateExpenseTypeCommand(
            tenantId,
            id,
            request.Name,
            request.SriSustentoCode,
            request.AffectsInventory,
            request.SuggestedRetentionCode,
            request.RetentionPercentage,
            request.ValidFrom,
            request.ValidUntil,
            request.Description,
            request.Code,
            request.IsActive);

        var result = await sender
            .SendAsync<UpdateExpenseTypeCommand, ExpenseTypeResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new DeleteExpenseTypeCommand(tenantId, id);

        var result = await sender
            .SendAsync<DeleteExpenseTypeCommand, bool>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> SeedDefaultsAsync(
        [FromRoute] Guid tenantId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SeedDefaultExpenseTypesCommand, int>(new SeedDefaultExpenseTypesCommand(tenantId), ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
