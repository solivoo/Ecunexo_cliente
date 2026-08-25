using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Business.Identity.Queries.GetTenantRole;
using EcuNexo.Business.Identity.Queries.ListTenantRoles;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class RoleEndpoints
{
    public static WebApplication MapRoleEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder roles = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/roles")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        roles.MapPost("/", CreateRoleAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));
        roles.MapGet("/", ListRolesAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.read"));
        roles.MapGet("/{roleId:guid}", GetRoleAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.read"));

        RouteGroupBuilder rolePerms = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/roles/{roleId:guid}/permissions")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        rolePerms.MapPost("/", GrantRolePermissionAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));
        rolePerms.MapPut("/", ReplaceRolePermissionsAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));
        rolePerms.MapDelete("/{permissionId:guid}", UnassignRolePermissionAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));

        RouteGroupBuilder assign = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/users/{userId:guid}/roles")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        assign.MapPost("/", AssignUserRoleAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));
        assign.MapDelete("/{roleId:guid}", UnassignUserRoleAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.roles.manage"));

        return app;
    }

    private static async Task<IResult> CreateRoleAsync(
        Guid tenantId,
        CreateRoleRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<CreateRoleCommand, CreateRoleResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/roles/{value.RoleId}",
            value);
    }

    private static async Task<IResult> ListRolesAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<ListTenantRolesQuery, IReadOnlyList<RoleListItemResponse>>(
                new ListTenantRolesQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetRoleAsync(Guid tenantId, Guid roleId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<GetTenantRoleQuery, GetTenantRoleResponse>(
                new GetTenantRoleQuery(tenantId, roleId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> AssignUserRoleAsync(
        Guid tenantId,
        Guid userId,
        AssignUserRoleRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<AssignUserRoleCommand, AssignUserRoleResponse>(
                body.ToCommand(tenantId, userId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Created(
            $"/api/v1/tenants/{tenantId}/users/{userId}/roles/{body.RoleId}",
            result.Value);
    }

    private static async Task<IResult> UnassignUserRoleAsync(
        Guid tenantId,
        Guid userId,
        Guid roleId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UnassignUserRoleCommand, UnassignUserRoleResponse>(
                new UnassignUserRoleCommand(tenantId, userId, roleId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GrantRolePermissionAsync(
        Guid tenantId,
        Guid roleId,
        GrantRolePermissionRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<GrantRolePermissionCommand, GrantRolePermissionResponse>(
                body.ToCommand(tenantId, roleId),
                ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var v = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{v.TenantId}/roles/{v.RoleId}/permissions/{v.PermissionId}",
            v);
    }

    private static async Task<IResult> ReplaceRolePermissionsAsync(
        Guid tenantId,
        Guid roleId,
        ReplaceRolePermissionsRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<ReplaceRolePermissionsCommand, ReplaceRolePermissionsResponse>(
                body.ToCommand(tenantId, roleId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UnassignRolePermissionAsync(
        Guid tenantId,
        Guid roleId,
        Guid permissionId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UnassignRolePermissionCommand, UnassignRolePermissionResponse>(
                new UnassignRolePermissionCommand(tenantId, roleId, permissionId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
