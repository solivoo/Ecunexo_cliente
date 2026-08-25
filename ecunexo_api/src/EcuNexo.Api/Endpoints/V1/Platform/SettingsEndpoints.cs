using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Platform;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Commands.UpsertUserUiPreferences;
using EcuNexo.Business.Platform.Queries.GetResolvedSettings;

namespace EcuNexo.Api.Endpoints.V1.Platform;

public static class SettingsEndpoints
{
    public static WebApplication MapSettingsEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder me = app
            .MapGroup("/api/v{version:apiVersion}/settings")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        me.MapGet("", GetResolvedSettingsAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.settings.read"));
        me.MapPut("/ui", UpsertUiPreferencesAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.settings.update"));

        RouteGroupBuilder tenant = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        tenant.MapGet("/settings", GetTenantSettingsAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.settings.read"));

        return app;
    }

    private static async Task<IResult> GetResolvedSettingsAsync(
        ICallerContext caller,
        ITenantContext tenant,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .AskAsync<GetResolvedSettingsQuery, GetResolvedSettingsResponse>(
                new GetResolvedSettingsQuery(
                    userId,
                    tenant.CurrentTenantId ?? caller.ExplicitTenantId,
                    caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }

    private static async Task<IResult> GetTenantSettingsAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .AskAsync<GetResolvedSettingsQuery, GetResolvedSettingsResponse>(
                new GetResolvedSettingsQuery(userId, tenantId, caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }

    private static async Task<IResult> UpsertUiPreferencesAsync(
        UpsertUserUiPreferencesRequest body,
        ICallerContext caller,
        ITenantContext tenant,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        var result = await sender
            .SendAsync<UpsertUserUiPreferencesCommand, UpsertUserUiPreferencesResponse>(
                body.ToCommand(
                    userId,
                    tenant.CurrentTenantId ?? caller.ExplicitTenantId,
                    caller.IsSubscriptionHolder),
                ct)
            .ConfigureAwait(false);
        return result.IsSuccess ? Results.Ok(result.Value!.Settings) : result.ToHttpResult();
    }
}
