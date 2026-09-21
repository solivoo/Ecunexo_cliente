using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Catalog;

/// <summary>
/// Aplica los límites transaccionales del módulo catálogo según el tier contratado
/// (<see cref="ModuleTierCatalog"/>): variantes totales/activas y plantillas de producto.
/// Un tenant sin entitlements (legacy) queda sin restricción.
/// </summary>
internal static class CatalogTierLimits
{
    public static async Task<Result> EnsureVariantsWithinLimitAsync(
        ITenantRepository tenants,
        ICatalogItemRepository items,
        Guid tenantId,
        int newVariantsCount,
        CancellationToken ct)
    {
        var tenant = await tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        var maxVariants = tenant?.GetModuleLimit(TenantModuleCodes.Catalog, ModuleTierCatalog.LimitMaxVariants);
        var maxActiveVariants = tenant?.GetModuleLimit(
            TenantModuleCodes.Catalog,
            ModuleTierCatalog.LimitMaxActiveVariants);

        if (maxVariants is int totalLimit)
        {
            var currentTotal = await items
                .CountVariantsAsync(tenantId, onlyActive: false, ct)
                .ConfigureAwait(false);
            if (currentTotal + newVariantsCount > totalLimit)
            {
                return Result.Failure(
                    new Error(
                        "catalog.variants.limit_reached",
                        $"Tu plan permite hasta {totalLimit} variantes y ya registraste {currentTotal}. Actualiza tu plan para continuar.",
                        ErrorType.Forbidden));
            }
        }

        if (maxActiveVariants is int activeLimit)
        {
            var currentActive = await items
                .CountVariantsAsync(tenantId, onlyActive: true, ct)
                .ConfigureAwait(false);
            if (currentActive + newVariantsCount > activeLimit)
            {
                return Result.Failure(
                    new Error(
                        "catalog.variants.active_limit_reached",
                        $"Tu plan permite hasta {activeLimit} variantes activas y ya registraste {currentActive}. Desactiva variantes o actualiza tu plan.",
                        ErrorType.Forbidden));
            }
        }

        return Result.Success();
    }

    public static async Task<Result> EnsureActiveVariantsWithinLimitAsync(
        ITenantRepository tenants,
        ICatalogItemRepository items,
        Guid tenantId,
        int newActiveVariantsCount,
        CancellationToken ct)
    {
        var tenant = await tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        var maxActiveVariants = tenant?.GetModuleLimit(
            TenantModuleCodes.Catalog,
            ModuleTierCatalog.LimitMaxActiveVariants);

        if (maxActiveVariants is not int activeLimit)
        {
            return Result.Success();
        }

        var currentActive = await items
            .CountVariantsAsync(tenantId, onlyActive: true, ct)
            .ConfigureAwait(false);
        if (currentActive + newActiveVariantsCount > activeLimit)
        {
            return Result.Failure(
                new Error(
                    "catalog.variants.active_limit_reached",
                    $"Tu plan permite hasta {activeLimit} variantes activas y ya registraste {currentActive}. Desactiva variantes o actualiza tu plan.",
                    ErrorType.Forbidden));
        }

        return Result.Success();
    }

    public static async Task<Result> EnsureProductTemplateWithinLimitAsync(
        ITenantRepository tenants,
        IProductTemplateRepository templates,
        Guid tenantId,
        CancellationToken ct)
    {
        var tenant = await tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        var maxTemplates = tenant?.GetModuleLimit(
            TenantModuleCodes.Catalog,
            ModuleTierCatalog.LimitMaxProductTemplates);

        if (maxTemplates is not int limit)
        {
            return Result.Success();
        }

        var current = await templates.CountByTenantAsync(tenantId, ct).ConfigureAwait(false);
        if (current + 1 > limit)
        {
            return Result.Failure(
                new Error(
                    "catalog.product_templates.limit_reached",
                    $"Tu plan permite hasta {limit} plantillas de producto y ya alcanzaste el máximo. Actualiza tu plan para crear más.",
                    ErrorType.Forbidden));
        }

        return Result.Success();
    }
}
