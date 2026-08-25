using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy;

public interface IActivationCodeRepository
{
    Task AddAsync(ActivationCode code, CancellationToken ct);

    /// <summary>Obtiene un código vigente y no agotado, con seguimiento EF para actualizar slots/consumo.</summary>
    Task<ActivationCode?> GetActiveForProvisioningByHashAsync(string codeHash, DateTimeOffset utcNow, CancellationToken ct);

    Task<bool> ExistsByHashAsync(string codeHash, CancellationToken ct);
}
