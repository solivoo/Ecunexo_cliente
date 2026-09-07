using EcuNexo.Business.Abstractions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EcuNexo.Data;

public sealed class EfUnitOfWork : IUnitOfWork
{
    private readonly EcuNexoDbContext _db;

    public EfUnitOfWork(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task SaveChangesAsync(CancellationToken ct) =>
        _db.SaveChangesAsync(ct);

    public async Task<bool> TrySaveChangesAsync(CancellationToken ct)
    {
        try
        {
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            DetachAddedEntities();
            return false;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private void DetachAddedEntities()
    {
        foreach (var entry in _db.ChangeTracker.Entries()
                     .Where(e => e.State == EntityState.Added)
                     .ToList())
        {
            entry.State = EntityState.Detached;
        }
    }
}
