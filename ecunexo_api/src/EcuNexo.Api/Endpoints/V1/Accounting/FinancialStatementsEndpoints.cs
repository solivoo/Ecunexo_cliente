using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Queries.GetFinancialStatements;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Accounting;

public static class FinancialStatementsEndpoints
{
    public static WebApplication MapFinancialStatementsEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/accounting/financial-statements")
            .WithApiVersionSet(versionSet)
            .WithTags("Accounting - Financial Statements NIIF")
            .RequireAuthorization();

        group.MapGet("/", GetFinancialStatementsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.balances.read",
                "contabilidad.read"));

        return app;
    }

    private static async Task<IResult> GetFinancialStatementsAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var targetMonth = month ?? DateTime.UtcNow.Month;

        var query = new GetFinancialStatementsQuery(tenantId, targetYear, targetMonth);
        var result = await sender
            .AskAsync<GetFinancialStatementsQuery, FinancialStatementsResponse>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
