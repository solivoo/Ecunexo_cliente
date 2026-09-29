using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Logistics;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Api.Endpoints.V1.Logistics;

public static class ShippingMethodEndpoints
{
    public static WebApplication MapShippingMethodEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/logistics/shipping-methods")
            .WithApiVersionSet(versionSet)
            .WithTags("Logistics")
            .RequireAuthorization();

        group.MapGet("/", ListShippingMethodsAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read", "facturacion.facturas.read"));

        group.MapGet("/{methodId:guid}", GetShippingMethodAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.read", "catalog.pricing.read", "facturacion.read", "facturacion.facturas.read"));

        group.MapPost("/", CreateShippingMethodAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.create", "catalog.pricing.update"));

        group.MapPut("/{methodId:guid}", UpdateShippingMethodAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.update"));

        group.MapDelete("/{methodId:guid}", DeleteShippingMethodAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny("ecommerce.orders.manage", "catalog.pricing.delete"));

        return app;
    }

    private static async Task<IResult> ListShippingMethodsAsync(
        Guid tenantId,
        bool? onlyActive,
        IShippingMethodRepository repository,
        CancellationToken ct)
    {
        var list = await repository.ListAsync(tenantId, onlyActive ?? false, ct).ConfigureAwait(false);
        var dtos = list.Select(ToDto).ToList();
        return Results.Ok(dtos);
    }

    private static async Task<IResult> GetShippingMethodAsync(
        Guid tenantId,
        Guid methodId,
        IShippingMethodRepository repository,
        CancellationToken ct)
    {
        var method = await repository.GetByIdAsync(tenantId, methodId, ct).ConfigureAwait(false);
        if (method is null)
        {
            return Results.NotFound(new { message = "El método de envío no existe." });
        }

        return Results.Ok(ToDto(method));
    }

    private static async Task<IResult> CreateShippingMethodAsync(
        Guid tenantId,
        CreateShippingMethodInput body,
        IShippingMethodRepository repository,
        IUnitOfWork unitOfWork,
        ICallerContext caller,
        CancellationToken ct)
    {
        var codeNormalized = (body.Code ?? string.Empty).Trim().ToUpperInvariant();
        var exists = await repository.ExistsCodeAsync(tenantId, codeNormalized, null, ct).ConfigureAwait(false);
        if (exists)
        {
            return Results.BadRequest(new { message = $"Ya existe un método de envío con el código '{codeNormalized}'." });
        }

        var methodResult = ShippingMethod.Create(
            Guid.NewGuid(),
            tenantId,
            codeNormalized,
            body.Name,
            body.Description,
            body.EstimatedDays,
            body.SortOrder,
            caller.UserId);

        if (methodResult.IsFailure)
        {
            return methodResult.ToHttpResult();
        }

        var method = methodResult.Value!;
        await repository.AddAsync(method, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Results.Created($"/api/v1/tenants/{tenantId}/logistics/shipping-methods/{method.Id}", ToDto(method));
    }

    private static async Task<IResult> UpdateShippingMethodAsync(
        Guid tenantId,
        Guid methodId,
        UpdateShippingMethodInput body,
        IShippingMethodRepository repository,
        IUnitOfWork unitOfWork,
        ICallerContext caller,
        CancellationToken ct)
    {
        var method = await repository.GetTrackedByIdAsync(tenantId, methodId, ct).ConfigureAwait(false);
        if (method is null)
        {
            return Results.NotFound(new { message = "El método de envío no existe." });
        }

        var codeNormalized = (body.Code ?? string.Empty).Trim().ToUpperInvariant();
        var exists = await repository.ExistsCodeAsync(tenantId, codeNormalized, methodId, ct).ConfigureAwait(false);
        if (exists)
        {
            return Results.BadRequest(new { message = $"Ya existe otro método de envío con el código '{codeNormalized}'." });
        }

        var updateResult = method.Update(
            codeNormalized,
            body.Name,
            body.Description,
            body.EstimatedDays,
            body.SortOrder,
            body.IsActive,
            caller.UserId);

        if (updateResult.IsFailure)
        {
            return updateResult.ToHttpResult();
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(ToDto(method));
    }

    private static async Task<IResult> DeleteShippingMethodAsync(
        Guid tenantId,
        Guid methodId,
        IShippingMethodRepository repository,
        IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var method = await repository.GetTrackedByIdAsync(tenantId, methodId, ct).ConfigureAwait(false);
        if (method is null)
        {
            return Results.NotFound(new { message = "El método de envío no existe." });
        }

        repository.Remove(method);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static ShippingMethodDto ToDto(ShippingMethod m) =>
        new(
            m.Id,
            m.TenantId,
            m.Code,
            m.Name,
            m.Description,
            m.EstimatedDays,
            m.SortOrder,
            m.IsActive,
            m.CreatedAt,
            m.UpdatedAt);
}
