namespace EcuNexo.Business.Pricing;

/// <summary>
/// Tarifa de impuesto aplicable a un ítem en una fecha. Abstrae la fuente tributaria para que
/// Pricing no duplique el catálogo de tarifas SRI de Facturación.
/// </summary>
public interface ITaxRateProvider
{
    Task<decimal> GetRateAsync(Guid tenantId, Guid catalogItemId, DateOnly date, CancellationToken ct);
}
