using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Warehousing;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Warehousing.Commands.CreateWarehouse;
using EcuNexo.Business.Warehousing.Commands.UpdateWarehouse;
using EcuNexo.Business.Warehousing.Queries.GetWarehouse;
using EcuNexo.Business.Warehousing.Queries.ListWarehouses;

namespace EcuNexo.Api.Endpoints.V1.Warehousing;

public static class WarehouseEndpoints
{
    public static WebApplication MapWarehouseEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/warehouses")
            .WithApiVersionSet(versionSet)
            .WithTags("Warehousing")
            .RequireAuthorization();

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("warehousing.locations.manage", "warehousing.warehouse.manage"));
        group.MapGet("/", ListAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "warehousing.read",
                    "warehousing.locations.manage",
                    "inventory.stock.read",
                    "inventory.documents.create"));
        group.MapGet("/{warehouseId:guid}", GetAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny(
                    "warehousing.read",
                    "warehousing.locations.manage",
                    "warehousing.warehouse.manage"));
        group.MapPut("/{warehouseId:guid}", UpdateAsync)
            .AddEndpointFilter(
                PermissionFilters.RequireAny("warehousing.locations.manage", "warehousing.warehouse.manage"));

        return app;
    }

    private static async Task<IResult> CreateAsync(
        Guid tenantId,
        CreateWarehouseRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateWarehouseCommand, CreateWarehouseResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created($"/api/v1/tenants/{value.TenantId}/warehouses/{value.WarehouseId}", value);
    }

    private static async Task<IResult> ListAsync(Guid tenantId, ISender sender, CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListWarehousesQuery, IReadOnlyList<WarehouseListItemResponse>>(
                new ListWarehousesQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetAsync(
        Guid tenantId,
        Guid warehouseId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetWarehouseQuery, WarehouseDetailResponse>(
                new GetWarehouseQuery(tenantId, warehouseId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> UpdateAsync(
        Guid tenantId,
        Guid warehouseId,
        UpdateWarehouseRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateWarehouseCommand, UpdateWarehouseResponse>(
                body.ToCommand(tenantId, warehouseId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
