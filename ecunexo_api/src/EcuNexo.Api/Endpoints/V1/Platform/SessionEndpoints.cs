using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetSession;

namespace EcuNexo.Api.Endpoints.V1.Platform;

public static class SessionEndpoints
{
    public static WebApplication MapSessionEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        group.MapGet("/session", GetSessionAsync);

        return app;
    }

    private static async Task<IResult> GetSessionAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is not { } userId)
        {
            return Results.Unauthorized();
        }

        if (caller.ExplicitTenantId is { } tid && tid != tenantId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .AskAsync<GetSessionQuery, SessionResponse>(new GetSessionQuery(tenantId, userId), ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
