using Asp.Versioning;
using Asp.Versioning.Builder;
using EcuNexo.Api.Contracts.V1.Platform;
using EcuNexo.Api.Extensions;
using EcuNexo.Api.Security;
using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Platform;
using EcuNexo.Business.Platform.Queries.GetTenantMenu;
using EcuNexo.Core.Platform.Navigation;

namespace EcuNexo.Api.Endpoints.V1.Platform;

public static class MenuItemEndpoints
{
    public static WebApplication MapMenuItemEndpointsV1(this WebApplication app)
    {
        ApiVersionSet versionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1, 0))
            .ReportApiVersions()
            .Build();

        RouteGroupBuilder platform = app
            .MapGroup("/api/v{version:apiVersion}/platform/menu-items")
            .WithApiVersionSet(versionSet)
            .WithTags("Platform")
            .RequireAuthorization();

        platform.MapGet("/", ListAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.menu.manage"));
        platform.MapGet("/{id}", GetByIdAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.menu.manage"));
        platform.MapPost("/", CreateAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.menu.manage"));
        platform.MapPut("/{id}", UpdateAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.menu.manage"));
        platform.MapDelete("/{id}", DeleteAsync)
            .AddEndpointFilter(PermissionFilters.Require("platform.menu.manage"));

        return app;
    }

    private static async Task<IResult> ListAsync(
        string? context,
        bool activeOnly,
        IMenuItemRepository repository,
        CancellationToken ct)
    {
        MenuContextKind? parsed = null;
        if (!string.IsNullOrWhiteSpace(context))
        {
            if (!Enum.TryParse<MenuContextKind>(context, ignoreCase: true, out var menuContext))
            {
                return Results.BadRequest(new { error = "context inválido." });
            }

            parsed = menuContext;
        }

        var items = await repository.ListAsync(parsed, activeOnly, ct).ConfigureAwait(false);
        return Results.Ok(items.Select(MenuItemResponse.FromEntity).ToList());
    }

    private static async Task<IResult> GetByIdAsync(
        string id,
        IMenuItemRepository repository,
        CancellationToken ct)
    {
        var item = await repository.GetByIdAsync(id, ct).ConfigureAwait(false);
        return item is null ? Results.NotFound() : Results.Ok(MenuItemResponse.FromEntity(item));
    }

    private static async Task<IResult> CreateAsync(
        MenuItemRequest body,
        IMenuItemRepository repository,
        CancellationToken ct)
    {
        if (!TryMapRequest(body, out var item, out var error))
        {
            return Results.BadRequest(new { error });
        }

        var existing = await repository.GetByIdAsync(item.Id, ct).ConfigureAwait(false);
        if (existing is not null)
        {
            return Results.Conflict(new { error = $"Ya existe menu item '{item.Id}'." });
        }

        await repository.AddAsync(item, ct).ConfigureAwait(false);
        return Results.Created($"/api/v1/platform/menu-items/{item.Id}", MenuItemResponse.FromEntity(item));
    }

    private static async Task<IResult> UpdateAsync(
        string id,
        MenuItemRequest body,
        IMenuItemRepository repository,
        CancellationToken ct)
    {
        var existing = await repository.GetByIdAsync(id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return Results.NotFound();
        }

        if (!TryMapRequest(body with { Id = id }, out var item, out var error))
        {
            return Results.BadRequest(new { error });
        }

        await repository.UpdateAsync(item, ct).ConfigureAwait(false);
        return Results.Ok(MenuItemResponse.FromEntity(item));
    }

    private static async Task<IResult> DeleteAsync(
        string id,
        IMenuItemRepository repository,
        CancellationToken ct)
    {
        var existing = await repository.GetByIdAsync(id, ct).ConfigureAwait(false);
        if (existing is null)
        {
            return Results.NotFound();
        }

        await repository.DeleteAsync(id, ct).ConfigureAwait(false);
        return Results.NoContent();
    }

    private static bool TryMapRequest(MenuItemRequest request, out MenuItem item, out string? error)
    {
        if (!Enum.TryParse<MenuContextKind>(request.Context, ignoreCase: true, out var context))
        {
            item = null!;
            error = "context inválido.";
            return false;
        }

        if (!Enum.TryParse<MenuPositionKind>(request.Position, ignoreCase: true, out var position))
        {
            item = null!;
            error = "position inválido.";
            return false;
        }

        item = new MenuItem
        {
            Id = request.Id,
            ParentId = request.ParentId,
            Label = request.Label,
            Icon = request.Icon,
            Route = request.Route,
            SortOrder = request.SortOrder,
            Context = context,
            ModuleCode = request.ModuleCode,
            Position = position,
            RequiredPermissions = request.RequiredPermissions,
            IsActive = request.IsActive,
            IsPlaceholder = request.IsPlaceholder,
        };
        error = null;
        return true;
    }
}

public static class TenantMenuEndpoints
{
    public static WebApplication MapTenantMenuEndpointsV1(this WebApplication app)
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

        group.MapGet("/menu", GetTenantMenuAsync);

        return app;
    }

    private static async Task<IResult> GetTenantMenuAsync(
        Guid tenantId,
        string? context,
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

        var menuContext = MenuContextKind.Operational;
        if (!string.IsNullOrWhiteSpace(context))
        {
            if (!Enum.TryParse<MenuContextKind>(context, ignoreCase: true, out menuContext))
            {
                return Results.BadRequest(new { error = "context inválido." });
            }
        }

        var result = await sender
            .AskAsync<GetTenantMenuQuery, TenantMenuResponse>(
                new GetTenantMenuQuery(tenantId, userId, menuContext),
                ct)
            .ConfigureAwait(false);
        return result.ToHttpResult();
    }
}
