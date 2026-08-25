using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity;
using EcuNexo.Business.Identity.Authorization;
using EcuNexo.Business.Identity.Queries.EvaluateAuthorization;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class AuthorizationEndpoints
{
    public static WebApplication MapAuthorizationEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/authorization")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        group.MapGet("/verify", VerifyPermissionAsync);
        group.MapPost("/evaluate", EvaluatePermissionAsync);

        return app;
    }

    private static async Task<IResult> VerifyPermissionAsync(
        Guid tenantId,
        string? permission,
        HttpContext http,
        IPermissionAccessGuard guard,
        ICallerContext caller,
        ITenantContext tenantContext,
        CancellationToken ct)
    {
        _ = tenantId;
        if (string.IsNullOrWhiteSpace(permission))
        {
            return Results.BadRequest(new { error = "El query «permission» es obligatorio." });
        }

        var evaluation = PolicyEvaluationContextFactory.Create(http, caller, tenantContext);
        var result = await guard.RequireAsync(permission, evaluation, ct).ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        return Results.Ok(new { granted = true, permission = permission.Trim() });
    }

    private static async Task<IResult> EvaluatePermissionAsync(
        Guid tenantId,
        EvaluateAuthorizationRequest body,
        HttpContext http,
        ICallerContext caller,
        ITenantContext tenantContext,
        IUserRepository users,
        ISender sender,
        CancellationToken ct)
    {
        _ = tenantId;
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(body.Permission))
        {
            return Results.BadRequest(new { error = "«permission» es obligatorio." });
        }

        var evaluation = await PolicyEvaluationContextFactory
            .CreateAsync(http, caller, tenantContext, users, ct)
            .ConfigureAwait(false);

        var result = await sender
            .AskAsync<EvaluateAuthorizationQuery, EvaluateAuthorizationResponse>(
                new EvaluateAuthorizationQuery(tenantId, userId, body.Permission, evaluation),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
