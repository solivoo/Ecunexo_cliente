using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform.Queries.GetDashboardAnalytics;

namespace EcuNexo.Api.Endpoints.V1.Platform;

public static class DashboardEndpoints
{
    public static WebApplication MapDashboardEndpointsV1(this WebApplication app)
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

        group.MapGet("/dashboard/analytics", GetDashboardAnalyticsAsync);

        return app;
    }

    private static async Task<IResult> GetDashboardAnalyticsAsync(
        Guid tenantId,
        ICallerContext caller,
        ISender sender,
        CancellationToken ct)
    {
        if (caller.UserId is null)
        {
            return Results.Unauthorized();
        }

        if (caller.ExplicitTenantId is { } tid && tid != tenantId)
        {
            return Results.Forbid();
        }

        var result = await sender
            .AskAsync<GetDashboardAnalyticsQuery, DashboardAnalyticsDto>(
                new GetDashboardAnalyticsQuery(tenantId), ct)
            .ConfigureAwait(false);

        return result.ToHttpResult();
    }
}
