using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Identity.Commands;
using EcuNexo.Core.Platform.Navigation;
using EcuNexo.Core.Tenancy;
using EcuNexo.Data;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Api.Development;

internal static class MenuCatalogSeeder
{
    public static async Task EnsureAsync(WebApplication app, CancellationToken cancellationToken)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<EcuNexoDbContext>();
        var sender = services.GetRequiredService<ISender>();

        await EnsurePermissionsAsync(sender, db, cancellationToken).ConfigureAwait(false);
        await EnsureProductModulesAsync(db, cancellationToken).ConfigureAwait(false);
        await EnsureMenuItemsAsync(db, cancellationToken).ConfigureAwait(false);

        // Siempre: roles system reciben permisos nuevos del catálogo (tenants ya existentes).
        await DevelopmentCatalogSeeder.EnsureSystemRolesHaveAllActivePermissionsAsync(
            sender,
            db,
            cancellationToken).ConfigureAwait(false);
    }

    private static async Task<bool> EnsurePermissionsAsync(
        ISender sender,
        EcuNexoDbContext db,
        CancellationToken cancellationToken)
    {
        var changed = false;

        foreach (var perm in MenuCatalogSeedData.Permissions)
        {
            var normalized = perm.Code.Trim().ToLowerInvariant();
            var existing = await db.Permissions
                .FirstOrDefaultAsync(p => p.DeletedAt == null && p.Code == normalized, cancellationToken)
                .ConfigureAwait(false);

            if (existing is not null)
            {
                if (string.Equals(existing.Module, perm.Module, StringComparison.Ordinal))
                {
                    continue;
                }

                var synced = existing.SetModule(perm.Module);
                if (synced.IsFailure)
                {
                    throw new InvalidOperationException($"{synced.Error?.Code}: {synced.Error?.Message}");
                }

                changed = true;
                continue;
            }

            var created = await sender
                .SendAsync<CreatePermissionCommand, CreatePermissionResponse>(
                    new CreatePermissionCommand(
                        perm.Code,
                        perm.Description,
                        perm.DisplayName,
                        perm.Module,
                        perm.Sort),
                    cancellationToken)
                .ConfigureAwait(false);

            if (!created.IsSuccess
                && !string.Equals(created.Error?.Code, "permission.code.duplicate", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"{created.Error?.Code}: {created.Error?.Message}");
            }

            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return changed;
    }

    private static async Task EnsureProductModulesAsync(EcuNexoDbContext db, CancellationToken cancellationToken)
    {
        foreach (var (code, displayName) in MenuCatalogSeedData.ProductModules)
        {
            var normalized = TenantModuleCodes.Canonicalize(code);
            var exists = await db.ProductModules
                .AsNoTracking()
                .AnyAsync(m => m.Code == normalized, cancellationToken)
                .ConfigureAwait(false);
            if (exists)
            {
                continue;
            }

            db.ProductModules.Add(new ProductModule
            {
                Code = normalized,
                DisplayName = displayName,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task EnsureMenuItemsAsync(EcuNexoDbContext db, CancellationToken cancellationToken)
    {
        var changed = false;
        foreach (var item in MenuCatalogSeedData.MenuItems)
        {
            var existing = await db.MenuItems
                .FirstOrDefaultAsync(m => m.Id == item.Id, cancellationToken)
                .ConfigureAwait(false);

            if (existing is null)
            {
                db.MenuItems.Add(item);
                changed = true;
                continue;
            }

            // Dev: sincroniza etiqueta/ruta/módulo/permisos para reflejar cambios del seed sin reset de BD.
            if (existing.Label != item.Label
                || existing.Route != item.Route
                || existing.ParentId != item.ParentId
                || existing.SortOrder != item.SortOrder
                || existing.Icon != item.Icon
                || existing.ModuleCode != item.ModuleCode
                || existing.Context != item.Context
                || existing.Position != item.Position
                || !existing.RequiredPermissions.SequenceEqual(item.RequiredPermissions)
                || existing.IsPlaceholder != item.IsPlaceholder
                || existing.IsActive != item.IsActive)
            {
                existing.Label = item.Label;
                existing.Route = item.Route;
                existing.ParentId = item.ParentId;
                existing.SortOrder = item.SortOrder;
                existing.Icon = item.Icon;
                existing.ModuleCode = item.ModuleCode;
                existing.Context = item.Context;
                existing.Position = item.Position;
                existing.RequiredPermissions = item.RequiredPermissions;
                existing.IsPlaceholder = item.IsPlaceholder;
                existing.IsActive = item.IsActive;
                changed = true;
            }
        }

        foreach (var retiredId in MenuCatalogSeedData.RetiredMenuItemIds)
        {
            var retired = await db.MenuItems
                .FirstOrDefaultAsync(m => m.Id == retiredId && m.IsActive, cancellationToken)
                .ConfigureAwait(false);
            if (retired is null)
            {
                continue;
            }

            retired.IsActive = false;
            changed = true;
        }

        // Crear empresa es acción de página (PageActionsMenu), no ítem de sidebar.
        var createCompanyRoutes = await db.MenuItems
            .Where(m => m.IsActive && m.Route != null
                && (m.Route == "organizacion/empresas/nueva"
                    || m.Route == "/organizacion/empresas/nueva"))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var item in createCompanyRoutes)
        {
            item.IsActive = false;
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
