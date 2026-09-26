namespace EcuNexo.Business.Pricing;

/// <summary>
/// Configuración del proveedor de tarifas IVA que consulta el catálogo SRI de Facturación.
/// </summary>
public sealed class BillingTaxRateOptions
{
    public const string SectionName = "BillingTaxRates";

    /// <summary>Base del API de Facturación (ej. http://localhost:5089). Vacío desactiva la consulta remota.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Código de impuesto SRI; 2 = IVA.</summary>
    public string TaxCode { get; set; } = "2";

    /// <summary><c>codigoPorcentaje</c> SRI por defecto; 4 = IVA 15%.</summary>
    public string DefaultRateCode { get; set; } = "4";

    /// <summary>Tarifa de respaldo (fracción) si Facturación no responde o el catálogo no está configurado.</summary>
    public decimal FallbackRate { get; set; } = EcuadorTaxRateProvider.DefaultIvaRate;

    /// <summary>Minutos de caché de una tarifa por fecha.</summary>
    public int CacheMinutes { get; set; } = 1440;

    /// <summary>Timeout HTTP en segundos.</summary>
    public int TimeoutSeconds { get; set; } = 5;
}
