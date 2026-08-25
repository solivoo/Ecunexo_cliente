using EcuNexo.Business.Abstractions;

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
}
