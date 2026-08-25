namespace EcuNexo.Business.Abstractions;

/// <summary>
/// Unit of work boundary — implemented in <c>EcuNexo.Data</c>.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken ct);
}
