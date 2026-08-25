using EcuNexo.Core.Common;

namespace EcuNexo.Business.Tenancy.Licensing;

/// <summary>
/// Servicio que lleva el conteo de límites transaccionales por tenant (ej. max_invoices_per_month).
/// Se resetea automáticamente cada mes calendario. 
/// </summary>
public interface IModuleUsageTracker
{
    /// <summary>
    /// Intenta incrementar el contador para el límite dado del tenant.
    /// Retorna <see cref="Result"/> exitoso si el incremento no excede el límite.
    /// Retorna <see cref="ErrorType.Forbidden"/> si el límite se excedió.
    /// </summary>
    Task<Result> TryIncrementAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        int limit,
        CancellationToken ct);

    /// <summary>
    /// Obtiene el valor actual del contador para un tenant + módulo + límite.
    /// Retorna 0 si no hay contador o el período expiró.
    /// </summary>
    Task<int> GetCurrentValueAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        CancellationToken ct);
}
