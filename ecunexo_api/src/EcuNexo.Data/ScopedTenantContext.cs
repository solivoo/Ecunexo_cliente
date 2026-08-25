using EcuNexo.Business.Abstractions;

namespace EcuNexo.Data;

public sealed class ScopedTenantContext : ITenantContext
{
    private Guid? _tenantId;

    public Guid? CurrentTenantId => _tenantId;

    public void SetCurrentTenant(Guid tenantId) => _tenantId = tenantId;
}
