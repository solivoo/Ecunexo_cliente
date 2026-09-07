namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Unit of work boundary — implemented in <c>EcuNexo.Data</c>.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken ct);

    /// <summary>
    /// Persiste cambios. Devuelve <c>false</c> si falló por violación de índice único (carrera concurrente).
    /// </summary>
    Task<bool> TrySaveChangesAsync(CancellationToken ct);
}
