using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Api.Endpoints.V1.Logistics;

public static class ShippingZoneEndpoints
{
    public static WebApplication MapShippingZoneEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/logistics/shipping-zones")
            .WithApiVersionSet(versionSet)
            .WithTags("Logistics")
            .RequireAuthorization();

        group.MapGet("/", ListShippingZonesAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read", "facturacion.facturas.read"));

        group.MapGet("/{zoneId:guid}", GetShippingZoneAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read", "facturacion.facturas.read"));

        group.MapPost("/", CreateShippingZoneAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.create", "catalog.pricing.update"));

        group.MapPut("/{zoneId:guid}", UpdateShippingZoneAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.update"));

        group.MapDelete("/{zoneId:guid}", DeleteShippingZoneAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.delete"));

        return app;
    }

    private static async Task<IResult> ListShippingZonesAsync(
        Guid tenantId,
        bool? onlyActive,
        IShippingZoneRepository repository,
        CancellationToken ct)
    {
        var list = await repository.ListAsync(tenantId, onlyActive ?? false, ct).ConfigureAwait(false);
        var dtos = list.Select(ToDto).ToList();
        return Results.Ok(dtos);
    }

    private static async Task<IResult> GetShippingZoneAsync(
        Guid tenantId,
        Guid zoneId,
        IShippingZoneRepository repository,
        CancellationToken ct)
    {
        var zone = await repository.GetByIdAsync(tenantId, zoneId, ct).ConfigureAwait(false);
        if (zone is null)
        {
            return Results.NotFound(new { message = "La zona de destino no existe." });
        }

        return Results.Ok(ToDto(zone));
    }

    private static async Task<IResult> CreateShippingZoneAsync(
        Guid tenantId,
        CreateShippingZoneInput body,
        IShippingZoneRepository repository,
        IUnitOfWork unitOfWork,
        ICallerContext caller,
        CancellationToken ct)
    {
        var codeNormalized = (body.Code ?? string.Empty).Trim().ToUpperInvariant();
        var exists = await repository.ExistsCodeAsync(tenantId, codeNormalized, null, ct).ConfigureAwait(false);
        if (exists)
        {
            return Results.BadRequest(new { message = $"Ya existe una zona de envío con el código '{codeNormalized}'." });
        }

        var zoneResult = ShippingZone.Create(
            Guid.NewGuid(),
            tenantId,
            codeNormalized,
            body.Name,
            body.Description,
            body.Provinces,
            body.SortOrder,
            caller.UserId);

        if (zoneResult.IsFailure)
        {
            return zoneResult.ToHttpResult();
        }

        var zone = zoneResult.Value!;
        await repository.AddAsync(zone, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Created($"/api/v1/tenants/{tenantId}/logistics/shipping-zones/{zone.Id}", ToDto(zone));
    }

    private static async Task<IResult> UpdateShippingZoneAsync(
        Guid tenantId,
        Guid zoneId,
        UpdateShippingZoneInput body,
        IShippingZoneRepository repository,
        IUnitOfWork unitOfWork,
        ICallerContext caller,
        CancellationToken ct)
    {
        var zone = await repository.GetTrackedByIdAsync(tenantId, zoneId, ct).ConfigureAwait(false);
        if (zone is null)
        {
            return Results.NotFound(new { message = "La zona de destino no existe." });
        }

        var codeNormalized = (body.Code ?? string.Empty).Trim().ToUpperInvariant();
        var exists = await repository.ExistsCodeAsync(tenantId, codeNormalized, zoneId, ct).ConfigureAwait(false);
        if (exists)
        {
            return Results.BadRequest(new { message = $"Ya existe otra zona de envío con el código '{codeNormalized}'." });
        }

        var updateResult = zone.Update(
            codeNormalized,
            body.Name,
            body.Description,
            body.Provinces,
            body.SortOrder,
            body.IsActive,
            caller.UserId);

        if (updateResult.IsFailure)
        {
            return updateResult.ToHttpResult();
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(ToDto(zone));
    }

    private static async Task<IResult> DeleteShippingZoneAsync(
        Guid tenantId,
        Guid zoneId,
        IShippingZoneRepository repository,
        IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var zone = await repository.GetTrackedByIdAsync(tenantId, zoneId, ct).ConfigureAwait(false);
        if (zone is null)
        {
            return Results.NotFound(new { message = "La zona de destino no existe." });
        }

        repository.Remove(zone);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static ShippingZoneDto ToDto(ShippingZone z) =>
        new(
            z.Id,
            z.TenantId,
            z.Code,
            z.Name,
            z.Description,
            z.Provinces,
            z.SortOrder,
            z.IsActive,
            z.CreatedAt,
            z.UpdatedAt);
}
