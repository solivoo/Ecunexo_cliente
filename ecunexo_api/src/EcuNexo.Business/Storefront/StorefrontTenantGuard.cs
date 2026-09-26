using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Storefront;

internal static class StorefrontTenantGuard
{
    public static readonly Error TenantNotFound = new(
        "storefront.tenant.not_found",
        "La tienda no está disponible.",
        ErrorType.NotFound);

    public static readonly Error ProductNotFound = new(
        "storefront.product.not_found",
        "El producto no está disponible.",
        ErrorType.NotFound);

    public static async Task<Error?> ValidateAsync(
        ITenantRepository tenants,
        Guid tenantId,
        CancellationToken ct)
    {
        var tenant = await tenants.GetByIdAsync(tenantId, ct).ConfigureAwait(false);
        if (tenant is null
            || tenant.Status is TenantStatus.Suspended or TenantStatus.Cancelled
            || !tenant.HasModuleWithMinTier(TenantModuleCodes.Ecommerce))
        {
            return TenantNotFound;
        }

        return null;
    }
}
