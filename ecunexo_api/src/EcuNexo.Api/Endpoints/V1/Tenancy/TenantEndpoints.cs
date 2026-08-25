using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Tenancy;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Tenancy.Commands;
using EcuNexo.Business.Tenancy.Commands.UpdateTenantSriLegal;
using EcuNexo.Business.Tenancy.Queries.GetTenantById;

namespace EcuNexo.Api.Endpoints.V1.Tenancy;

public static class TenantEndpoints
{
    public static WebApplication MapTenantEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app.MapGroup("/api/v{version:apiVersion}/tenants")
            .WithApiVersionSet(versionSet)
            .WithTags("Tenancy");

        group.MapPost("/", CreateTenantAsync);

        group.MapGet("/{tenantId:guid}", GetTenantByIdAsync)
            .RequireAuthorization()
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "tenancy.tenant.read",
                    "facturacion.read",
                    "facturacion.facturas.read",
                    "facturacion.facturas.read.all",
                    "facturacion.facturas.create",
                    "facturacion.comprobantes.read"));

        group.MapPut("/{tenantId:guid}/sri-legal", UpdateTenantSriLegalAsync)
            .RequireAuthorization()
            .AddEndpointFilter(PermissionFilters.Require("tenancy.tenant.update"));

        return app;
    }

    private static async Task<IResult> CreateTenantAsync(
        CreateTenantRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender.SendAsync<CreateTenantCommand, CreateTenantResponse>(body.ToCommand(), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created($"/api/v1/tenants/{value.TenantId}", value);
    }

    private static async Task<IResult> GetTenantByIdAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender.AskAsync<GetTenantByIdQuery, GetTenantByIdResponse>(
                new GetTenantByIdQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateTenantSriLegalAsync(
        Guid tenantId,
        UpdateTenantSriLegalRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateTenantSriLegalCommand, UpdateTenantSriLegalResponse>(
                body.ToCommand(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
