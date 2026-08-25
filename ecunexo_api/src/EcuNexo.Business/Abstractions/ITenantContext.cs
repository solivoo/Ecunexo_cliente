namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Tenant resuelto para la petición HTTP — alimenta filtros globales de EF.
/// Cuando <see cref="CurrentTenantId"/> es null, los filtros por tenant no restringen (p. ej. <c>POST /tenants</c>).
/// </summary>
public interface ITenantContext
{
    Guid? CurrentTenantId { get; }

    void SetCurrentTenant(Guid tenantId);
}
