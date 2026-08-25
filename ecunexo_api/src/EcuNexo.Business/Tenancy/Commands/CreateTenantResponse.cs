using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Commands;

public sealed record CreateTenantResponse(Guid TenantId)
{
    public static CreateTenantResponse FromTenant(Tenant tenant)
    {
        ArgumentNullException.ThrowIfNull(tenant);
        return new CreateTenantResponse(tenant.Id);
    }
}
