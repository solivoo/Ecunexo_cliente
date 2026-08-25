using EcuNexo.Business.Tenancy;
using EcuNexo.Core.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace EcuNexo.Data.Repositories;

public sealed class ActivationCodeRepository : IActivationCodeRepository
{
    private readonly EcuNexoDbContext _db;

    public ActivationCodeRepository(EcuNexoDbContext db)
    {
        _db = db;
    }

    public Task AddAsync(ActivationCode code, CancellationToken ct)
    {
        _db.ActivationCodes.Add(code);
        return Task.CompletedTask;
    }

    public Task<ActivationCode?> GetActiveForProvisioningByHashAsync(
        string codeHash,
        DateTimeOffset utcNow,
        CancellationToken ct) =>
        _db.ActivationCodes
            .Where(a => a.CodeHash == codeHash && a.ProvisioningSlotsRemaining > 0 && a.ExpiresAtUtc > utcNow)
            .FirstOrDefaultAsync(ct);

    public Task<bool> ExistsByHashAsync(string codeHash, CancellationToken ct) =>
        _db.ActivationCodes.AsNoTracking().AnyAsync(a => a.CodeHash == codeHash, ct);
}
