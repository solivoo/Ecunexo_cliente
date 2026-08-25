using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

/// <summary>
/// Repositorio para contadores de uso transaccional (<see cref="ModuleUsageCounter"/>).
/// </summary>
public interface IModuleUsageCounterRepository
{
    /// <summary>
    /// Obtiene el contador para un tenant + módulo + clave de límite.
    /// Retorna <c>null</c> si no existe.
    /// </summary>
    Task<ModuleUsageCounter?> GetAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        CancellationToken ct);

    /// <summary>
    /// Agrega un nuevo contador.
    /// </summary>
    Task AddAsync(ModuleUsageCounter counter, CancellationToken ct);
}
