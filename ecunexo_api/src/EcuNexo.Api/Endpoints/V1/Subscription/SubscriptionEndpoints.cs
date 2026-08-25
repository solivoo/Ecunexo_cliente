using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Tenancy;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSubscriptionSession;
using EcuNexo.Business.Tenancy.Commands.ApplySubscriptionLicenseUpgrade;
using EcuNexo.Business.Tenancy.Commands.CancelSubscriptionCompany;
using EcuNexo.Business.Tenancy.Commands.ProvisionSubscriptionCompany;
using EcuNexo.Business.Tenancy.Commands.SwitchToCompanySession;
using EcuNexo.Business.Tenancy.Commands.UpdateSubscriptionCompany;
using EcuNexo.Business.Tenancy.Queries.GetSubscriptionCompany;
using EcuNexo.Business.Tenancy.Queries.GetTenantById;
using EcuNexo.Business.Tenancy.Queries.ListSubscriptionCompanies;

namespace EcuNexo.Api.Endpoints.V1.Subscription;

public static class SubscriptionEndpoints
{
    public static WebApplication MapSubscriptionEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app.MapGroup("/api/v{version:apiVersion}/subscription")
            .WithApiVersionSet(versionSet)
            .WithTags("Subscription")
            .RequireAuthorization();

        group.MapGet("/session", GetSubscriptionSessionAsync);
        group.MapPost("/license", ApplySubscriptionLicenseUpgradeAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.license.apply"));
        group.MapGet("/companies", ListSubscriptionCompaniesAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.read"));
        group.MapPost("/companies", ProvisionSubscriptionCompanyAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.create"));
        group.MapGet("/companies/{tenantId:guid}", GetSubscriptionCompanyAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.read"));
        group.MapPut("/companies/{tenantId:guid}", UpdateSubscriptionCompanyAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.update"));
        group.MapPost("/companies/{tenantId:guid}/session", SwitchToCompanySessionAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.read"));
        group.MapDelete("/companies/{tenantId:guid}", CancelSubscriptionCompanyAsync)
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenants.delete"));

        return app;
    }

    private static async Task<IResult> GetSubscriptionSessionAsync(
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .AskAsync<GetSubscriptionSessionQuery, SubscriptionSessionResponse>(
                new GetSubscriptionSessionQuery(accountId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ApplySubscriptionLicenseUpgradeAsync(
        ApplySubscriptionLicenseUpgradeRequest body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .SendAsync<ApplySubscriptionLicenseUpgradeCommand, ApplySubscriptionLicenseUpgradeResponse>(
                body.ToCommand(accountId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListSubscriptionCompaniesAsync(
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .AskAsync<ListSubscriptionCompaniesQuery, ListSubscriptionCompaniesResponse>(
                new ListSubscriptionCompaniesQuery(accountId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ProvisionSubscriptionCompanyAsync(
        ProvisionSubscriptionCompanyRequest body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .SendAsync<ProvisionSubscriptionCompanyCommand, ProvisionSubscriptionCompanyResponse>(
                body.ToCommand(accountId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created($"/api/v1/tenants/{value.TenantId}", value);
    }

    private static async Task<IResult> GetSubscriptionCompanyAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .AskAsync<GetSubscriptionCompanyQuery, GetTenantByIdResponse>(
                new GetSubscriptionCompanyQuery(accountId, tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateSubscriptionCompanyAsync(
        Guid tenantId,
        UpdateSubscriptionCompanyRequest body,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .SendAsync<UpdateSubscriptionCompanyCommand, UpdateSubscriptionCompanyResponse>(
                body.ToCommand(accountId, tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> SwitchToCompanySessionAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .SendAsync<SwitchToCompanySessionCommand, SwitchToCompanySessionResponse>(
                new SwitchToCompanySessionCommand(accountId, tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> CancelSubscriptionCompanyAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (!caller.IsSubscriptionHolder || caller.UserId is not { } accountId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .SendAsync<CancelSubscriptionCompanyCommand, CancelSubscriptionCompanyResponse>(
                new CancelSubscriptionCompanyCommand(accountId, tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
