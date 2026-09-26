namespace EcuNexo.Business.Pricing;

/// <summary>
/// Implementación MVP para Ecuador: IVA general vigente 15% (SRI código 2 / rate code 4).
/// Debe evolucionar al catálogo de tarifas de Facturación sin cambiar el contrato del motor.
/// </summary>
public sealed class EcuadorTaxRateProvider : ITaxRateProvider
{
    public const decimal DefaultIvaRate = 0.15m;

    public Task<decimal> GetRateAsync(Guid tenantId, Guid catalogItemId, DateOnly date, CancellationToken ct) =>
        Task.FromResult(DefaultIvaRate);
}
