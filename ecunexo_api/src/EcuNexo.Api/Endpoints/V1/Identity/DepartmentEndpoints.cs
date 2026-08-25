using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Identity;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Business.Identity.Queries.GetTenantDepartment;
using EcuNexo.Business.Identity.Queries.ListTenantDepartments;

namespace EcuNexo.Api.Endpoints.V1.Identity;

public static class DepartmentEndpoints
{
    public static WebApplication MapDepartmentEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder group = app
            .MapGroup("/api/v{version:apiVersion}/tenants/{tenantId:guid}/departments")
            .WithApiVersionSet(versionSet)
            .WithTags("Identity")
            .RequireAuthorization();

        group.MapPost("/", CreateDepartmentAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.departments.manage"));
        group.MapPut("/{departmentId:guid}", UpdateDepartmentAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.departments.manage"));
        group.MapGet("/", ListDepartmentsAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.departments.read"));
        group.MapGet("/{departmentId:guid}", GetDepartmentAsync)
            .AddEndpointFilter(PermissionFilters.Require("identity.departments.read"));

        return app;
    }

    private static async Task<IResult> CreateDepartmentAsync(
        Guid tenantId,
        CreateDepartmentRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<CreateDepartmentCommand, CreateDepartmentResponse>(body.ToCommand(tenantId), ct)
            .ConfigureAwait(false);
        if (!result.IsSuccess)
        {
            return result.ToHttpResult();
        }

        var value = result.Value!;
        return Results.Created(
            $"/api/v1/tenants/{value.TenantId}/departments/{value.DepartmentId}",
            value);
    }

    private static async Task<IResult> UpdateDepartmentAsync(
        Guid tenantId,
        Guid departmentId,
        UpdateDepartmentRequest body,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .SendAsync<UpdateDepartmentCommand, UpdateDepartmentResponse>(
                body.ToCommand(tenantId, departmentId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> GetDepartmentAsync(
        Guid tenantId,
        Guid departmentId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<GetTenantDepartmentQuery, DepartmentListItemResponse>(
                new GetTenantDepartmentQuery(tenantId, departmentId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }

    private static async Task<IResult> ListDepartmentsAsync(
        Guid tenantId,
        ISender sender,
        CancellationToken ct)
    {
        var result = await sender
            .AskAsync<ListTenantDepartmentsQuery, IReadOnlyList<DepartmentListItemResponse>>(
                new ListTenantDepartmentsQuery(tenantId),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
