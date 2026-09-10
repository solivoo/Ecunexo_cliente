using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Customers;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Customers;
using Microsoft.AspNetCore.Mvc;

namespace EcuNexo.Api.Endpoints.V1.Customers;

public static class CustomerTypeEndpoints
{
    public static WebApplication MapCustomerTypeEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/customers/types")
            .WithApiVersionSet(versionSet)
            .WithTags("CustomerTypes")
            .RequireAuthorization();

        group.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.RequireAny(
                "customers.read",
                "customers.manage",
                "repairs.batches.read",
                "facturacion.read",
                "facturacion.facturas.create"));

        group.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        group.MapPut("/{typeId:guid}", UpdateAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        group.MapDelete("/{typeId:guid}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.Require("customers.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        [FromRoute] Guid tenantId,
        [FromQuery] bool activeOnly,
        [FromServices] ICustomerTypeDefinitionRepository repo,
        CancellationToken ct)
    {
        var items = await repo.ListAsync(tenantId, activeOnly, ct).ConfigureAwait(false);
        return Results.Ok(items.Select(ToDto).ToList());
    }

    private static async Task<IResult> CreateAsync(
        [FromRoute] Guid tenantId,
        [FromBody] CreateCustomerTypeApiRequest request,
        [FromServices] ICustomerTypeDefinitionRepository repo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        await repo.EnsureSystemDefaultsAsync(tenantId, ct).ConfigureAwait(false);

        if (await repo.ExistsByNameAsync(tenantId, request.Name, null, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe un tipo de cliente con ese nombre." });
        }

        var code = await repo.GetNextCustomCodeAsync(tenantId, ct).ConfigureAwait(false);
        var sort = request.SortOrder ?? code;
        var shortLabel = string.IsNullOrWhiteSpace(request.ShortLabel) ? request.Name : request.ShortLabel;

        var created = CustomerTypeDefinition.CreateCustom(
            Guid.NewGuid(),
            tenantId,
            code,
            request.Name,
            shortLabel,
            request.Tone ?? "primary",
            sort);

        if (created.IsFailure)
        {
            return created.ToHttpResult();
        }

        await repo.AddAsync(created.Value!, ct).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(ToDto(created.Value!));
    }

    private static async Task<IResult> UpdateAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid typeId,
        [FromBody] UpdateCustomerTypeApiRequest request,
        [FromServices] ICustomerTypeDefinitionRepository repo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var entity = await repo.GetTrackedByIdAsync(tenantId, typeId, ct).ConfigureAwait(false);
        if (entity is null)
        {
            return Results.NotFound(new { message = "Tipo de cliente no encontrado." });
        }

        if (await repo.ExistsByNameAsync(tenantId, request.Name, typeId, ct).ConfigureAwait(false))
        {
            return Results.Conflict(new { error = "Ya existe otro tipo de cliente con ese nombre." });
        }

        var shortLabel = string.IsNullOrWhiteSpace(request.ShortLabel) ? request.Name : request.ShortLabel;
        var update = entity.Update(request.Name, shortLabel, request.Tone ?? entity.Tone, request.SortOrder ?? entity.SortOrder);
        if (update.IsFailure)
        {
            return update.ToHttpResult();
        }

        if (request.IsActive.HasValue)
        {
            if (request.IsActive.Value)
            {
                entity.Activate();
            }
            else
            {
                entity.Deactivate();
            }
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.Ok(ToDto(entity));
    }

    private static async Task<IResult> DeleteAsync(
        [FromRoute] Guid tenantId,
        [FromRoute] Guid typeId,
        [FromServices] ICustomerTypeDefinitionRepository repo,
        [FromServices] IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var entity = await repo.GetTrackedByIdAsync(tenantId, typeId, ct).ConfigureAwait(false);
        if (entity is null)
        {
            return Results.NotFound(new { message = "Tipo de cliente no encontrado." });
        }

        if (entity.IsSystem)
        {
            return Results.Conflict(new { error = "Los tipos de sistema no se pueden eliminar; puedes desactivarlos." });
        }

        entity.SoftDelete();
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static CustomerTypeDefinitionDto ToDto(CustomerTypeDefinition t) =>
        new(t.Id, t.Code, t.Name, t.ShortLabel, t.Tone, t.SortOrder, t.IsSystem, t.IsActive);
}
