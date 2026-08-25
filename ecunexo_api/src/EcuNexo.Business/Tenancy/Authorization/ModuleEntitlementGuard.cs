using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Authorization;

public sealed class ModuleEntitlementGuard : IModuleEntitlementGuard
{
    private readonly ITenantRepository _tenants;

    public ModuleEntitlementGuard(ITenantRepository tenants)
    {
        _tenants = tenants;
    }

    public async Task<Result> RequireModuleForPermissionAsync(
        Guid tenantId,
        string permissionCode,
        CancellationToken ct)
    {
        var productModule = PermissionModuleMapper.ResolveProductModule(permissionCode);
        if (productModule is null)
        {
            return Result.Success();
        }

        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure(
                new Error("tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var entitlements = tenant.ModuleEntitlements;

        // Modelo de tiers activo
        if (entitlements is not null && entitlements.Count > 0)
        {
            if (entitlements.Any(e => string.Equals(e.ModuleCode, productModule, StringComparison.OrdinalIgnoreCase)))
            {
                return Result.Success();
            }

            return Result.Failure(
                new Error(
                    "module.not_entitled",
                    $"El módulo «{productModule}» no está contratado para esta organización.",
                    ErrorType.Forbidden));
        }

        // Fallback legacy
        var enabled = tenant.EnabledModuleCodes;
        if (enabled is null || enabled.Count == 0)
        {
            return Result.Success();
        }

        if (enabled.Any(m => string.Equals(m, productModule, StringComparison.OrdinalIgnoreCase)))
        {
            return Result.Success();
        }

        return Result.Failure(
            new Error(
                "module.not_entitled",
                $"El módulo «{productModule}» no está habilitado para esta organización.",
                ErrorType.Forbidden));
    }

    public async Task<Result> RequireModuleForPermissionWithTierAsync(
        Guid tenantId,
        string permissionCode,
        ModuleTier? requiredTier,
        CancellationToken ct)
    {
        var productModule = PermissionModuleMapper.ResolveProductModule(permissionCode);
        if (productModule is null)
        {
            return Result.Success();
        }

        var tenant = await _tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null)
        {
            return Result.Failure(
                new Error("tenant.not_found", "La organización no existe.", ErrorType.NotFound));
        }

        var entitlements = tenant.ModuleEntitlements;

        // Sin entitlements → modo legacy, sin restricción de tier
        if (entitlements is null || entitlements.Count == 0)
        {
            var enabled = tenant.EnabledModuleCodes;
            if (enabled is null || enabled.Count == 0)
            {
                return Result.Success();
            }

            if (enabled.Any(m => string.Equals(m, productModule, StringComparison.OrdinalIgnoreCase)))
            {
                return Result.Success();
            }

            return Result.Failure(
                new Error(
                    "module.not_entitled",
                    $"El módulo «{productModule}» no está habilitado para esta organización.",
                    ErrorType.Forbidden));
        }

        var entitlement = entitlements
            .FirstOrDefault(e => string.Equals(e.ModuleCode, productModule, StringComparison.OrdinalIgnoreCase));

        if (entitlement is null)
        {
            return Result.Failure(
                new Error(
                    "module.not_entitled",
                    $"El módulo «{productModule}» no está contratado para esta organización.",
                    ErrorType.Forbidden));
        }

        if (requiredTier is not null && entitlement.Tier < requiredTier.Value)
        {
            return Result.Failure(
                new Error(
                    "module.tier.insufficient",
                    $"El módulo «{productModule}» requiere tier {requiredTier} como mínimo (contratado: {entitlement.Tier}).",
                    ErrorType.Forbidden));
        }

        return Result.Success();
    }
}
