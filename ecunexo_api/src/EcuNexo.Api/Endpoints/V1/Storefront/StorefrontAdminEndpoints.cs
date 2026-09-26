using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Storefront;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Storefront;
using EcuNexo.Business.Storefront.Commands.CreateStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.DeleteStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.SetPrimaryStorefrontDomain;
using EcuNexo.Business.Storefront.Commands.VerifyStorefrontDomain;
using EcuNexo.Business.Storefront.Queries.ListStorefrontDomains;

namespace EcuNexo.Api.Endpoints.V1.Storefront;

public static class StorefrontAdminEndpoints
{
    public static WebApplication MapStorefrontAdminEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder domains = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/ecommerce/storefront/domains")
            .WithApiVersionSet(versionSet)
            .WithTags("Storefront")
            .RequireAuthorization();

        domains.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.storefront.manage"));
        domains.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.storefront.manage"));
        domains.MapDelete("/{domainId:guid}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.storefront.manage"));
        domains.MapPut("/{domainId:guid}/primary", SetPrimaryAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.storefront.manage"));
        domains.MapPost("/{domainId:guid}/verify", VerifyAsync)
            .AddEndpointFilter(PermissionFilters.Require("ecommerce.storefront.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListStorefrontDomainsQuery, IReadOnlyList<StorefrontDomainDto>>(
                new ListStorefrontDomainsQuery(tenantId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> CreateAsync(
        Guid tenantId,
        CreateStorefrontDomainRequest body,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateStorefrontDomainCommand, StorefrontDomainDto>(
                new CreateStorefrontDomainCommand(tenantId, body.Domain, caller.UserId),
                ct)
            .ConfigureAwait(false);

        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{tenantId}/ecommerce/storefront/domains/{value.Id}",
            value);
    }

    private static async Task<IResult> DeleteAsync(
        Guid tenantId,
        Guid domainId,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<DeleteStorefrontDomainCommand, bool>(
                new DeleteStorefrontDomainCommand(tenantId, domainId, caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> SetPrimaryAsync(
        Guid tenantId,
        Guid domainId,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<SetPrimaryStorefrontDomainCommand, StorefrontDomainDto>(
                new SetPrimaryStorefrontDomainCommand(tenantId, domainId, caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }

    private static async Task<IResult> VerifyAsync(
        Guid tenantId,
        Guid domainId,
        ISender sender,
        ICallerContext caller,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<VerifyStorefrontDomainCommand, StorefrontDomainDto>(
                new VerifyStorefrontDomainCommand(tenantId, domainId, caller.UserId),
                ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
