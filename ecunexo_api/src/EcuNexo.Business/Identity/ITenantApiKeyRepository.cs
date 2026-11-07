using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

public interface ITenantApiKeyRepository
{
    Task AddAsync(TenantApiKey apiKey, CancellationToken ct);

    Task<IReadOnlyList<TenantApiKey>> ListByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<TenantApiKey?> GetByIdAsync(Guid tenantId, Guid apiKeyId, CancellationToken ct);

    Task<TenantApiKey?> GetByIdForUpdateAsync(Guid tenantId, Guid apiKeyId, CancellationToken ct);

    /// <summary>
    /// Busca una credencial no eliminada por su prefijo único (sin filtro de tenant previo, para el middleware de autenticación).
    /// </summary>
    Task<TenantApiKey?> GetByPrefixUnfilteredAsync(string keyPrefix, CancellationToken ct);

    Task TouchLastUsedAsync(Guid tenantId, Guid apiKeyId, DateTimeOffset usedAt, CancellationToken ct);
}
