using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Accounting.Queries.GetMonthlyTaxDeclaration;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Accounting;

public static class TaxDeclarationEndpoints
{
    public static WebApplication MapTaxDeclarationEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/accounting/tax-declarations")
            .WithApiVersionSet(versionSet)
            .WithTags("Accounting - Tax Declarations SRI")
            .RequireAuthorization();

        group.MapGet("/monthly", GetMonthlyDeclarationAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "contabilidad.declaraciones.read",
                "contabilidad.read"));

        return app;
    }

    private static async Task<IResult> GetMonthlyDeclarationAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromServices] ISender sender,
        CancellationToken ct)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var targetMonth = month ?? DateTime.UtcNow.Month;

        var query = new GetMonthlyTaxDeclarationQuery(tenantId, targetYear, targetMonth);
        var result = await sender
            .AskAsync<GetMonthlyTaxDeclarationQuery, MonthlyTaxDeclarationResponse>(query, ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
