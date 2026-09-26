namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Conflicto de concurrencia optimista detectado por la capa de persistencia al guardar cambios
/// (por ejemplo, la fila versionada de stock cambió entre la lectura y la escritura).
/// </summary>
public sealed class ConcurrencyConflictException : Exception
{
    public ConcurrencyConflictException(string message)
        : base(message)
    {
    }

    public ConcurrencyConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
