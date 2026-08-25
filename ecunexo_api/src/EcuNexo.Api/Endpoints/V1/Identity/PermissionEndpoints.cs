using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Business.Identity.Queries.GetPermissionById;
using EcuNexo.Business.Identity.Queries.ListPermissions;
using EcuNexo.Business.Identity.Queries.ListPermissionPolicies;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class PermissionEndpoints
{
    public static WebApplication MapPermissionEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/permissions")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        group.MapPost("/", CreatePermissionAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.permissions.manage"));
        // roles.manage también: hace falta el catálogo para asignar permisos a un rol.
        group.MapGet("/", ListPermissionsAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("identity.permissions.read", "identity.roles.manage"));
        group.MapGet("/{permissionId:guid}", GetPermissionAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("identity.permissions.read", "identity.roles.manage"));

        RouteGroupBuilder policyRules = app
            .MapGroup("/api/v{version:apiVersion}/permissions/{permissionId:guid}/policies")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        policyRules.MapPost("/", CreatePolicyAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.policies.manage"));

        policyRules.MapGet("/", ListPoliciesAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.policies.manage"));

        return app;
    }

    private static async Task<IResult> CreatePolicyAsync(
        Guid permissionId,
        CreatePolicyRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<CreatePolicyCommand, CreatePolicyResponse>(
                body.ToCommand(permissionId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/permissions/{value.PermissionId}/policies/{value.PolicyId}",
            value);
    }

    private static async Task<IResult> CreatePermissionAsync(
        CreatePermissionRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<CreatePermissionCommand, CreatePermissionResponse>(body.ToCommand(), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created($"/api/v1/permissions/{value.PermissionId}", value);
    }

    private static async Task<IResult> ListPermissionsAsync(ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<ListPermissionsQuery, IReadOnlyList<PermissionListItemResponse>>(
                new ListPermissionsQuery(),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetPermissionAsync(Guid permissionId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<GetPermissionByIdQuery, PermissionDetailResponse>(
                new GetPermissionByIdQuery(permissionId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListPoliciesAsync(Guid permissionId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<ListPermissionPoliciesQuery, IReadOnlyList<PolicyListItemResponse>>(
                new ListPermissionPoliciesQuery(permissionId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
