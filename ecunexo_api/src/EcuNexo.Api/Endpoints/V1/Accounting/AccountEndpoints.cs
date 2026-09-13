using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Accounting;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting;
using EcuNexo.Business.Accounting.Commands.CreateAccount;
using EcuNexo.Business.Accounting.Commands.DeleteAccount;
using EcuNexo.Business.Accounting.Commands.SeedStandardEcuadorPlan;
using EcuNexo.Business.Accounting.Commands.UpdateAccount;
using EcuNexo.Business.Accounting.Queries.ListAccounts;
using EcuNexo.Core.Accounting;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Accounting;

public static class AccountEndpoints
{
    public static WebApplication MapAccountEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/accounting/accounts")
            .WithApiVersionSet(versionSet)
            .WithTags("Accounting - Chart of Accounts")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.plan.contable.read",
                "contabilidad.cuentas.read",
                "contabilidad.read"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.plan.contable.manage",
                "contabilidad.cuentas.manage"));

        group.MapPut("/{id:guid}", UpdateAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.plan.contable.manage",
                "contabilidad.cuentas.manage"));

        group.MapDelete("/{id:guid}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.plan.contable.manage",
                "contabilidad.cuentas.manage"));

        group.MapPost("/seed", SeedStandardPlanAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.plan.contable.manage",
                "contabilidad.cuentas.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] int? type,
        [FromQuery] bool? allowsMovementOnly,
        [FromQuery] bool? activeOnly,
        [FromQuery] string? search,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        AccountType? accountType = type.HasValue && Enum.IsDefined(typeof(AccountType), type.Value)
            ? (AccountType)type.Value
            : null;

        var result = await sender
            .AskAsync<ListAccountsQuery, IReadOnlyList<AccountResponse>>(
                new ListAccountsQuery(tenantId, accountType, allowsMovementOnly, activeOnly, search),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateAccountApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new CreateAccountCommand(
            tenantId,
            request.Code,
            request.Name,
            request.AccountType,
            request.Nature,
            request.ParentAccountId,
            request.ParentCode,
            request.AllowsMovement,
            request.Description);

        var result = await sender
            .SendAsync<CreateAccountCommand, AccountResponse>(command, ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Created($"/api/v1/tenants/{tenantId}/accounting/accounts/{result.Value!.Id}", result.Value);
    }

    private static async Task<IResult> UpdateAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromBody] UpdateAccountApiRequest request,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new UpdateAccountCommand(
            tenantId,
            id,
            request.Name,
            request.Description,
            request.AllowsMovement,
            request.IsActive,
            request.Nature);

        var result = await sender
            .SendAsync<UpdateAccountCommand, AccountResponse>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> DeleteAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid id,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var command = new DeleteAccountCommand(tenantId, id);

        var result = await sender
            .SendAsync<DeleteAccountCommand, bool>(command, ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> SeedStandardPlanAsync(
        [FromRoute] Guid tenantId,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SeedStandardEcuadorPlanCommand, int>(
                new SeedStandardEcuadorPlanCommand(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
