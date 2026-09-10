namespace EcuNexo.Core.Customers;

/// <summary>
/// Tipo de identificación tributaria o legal del cliente en Ecuador y para operaciones comerciales.
/// </summary>
public enum CustomerIdentificationType
{
    /// <summary>Registro Único de Contribuyentes (13 dígitos numéricos).</summary>
    Ruc = 1,

    /// <summary>Cédula de identidad (10 dígitos numéricos).</summary>
    Cedula = 2,

    /// <summary>Pasaporte o documento de identificación para extranjeros.</summary>
    Pasaporte = 3,

    /// <summary>Consumidor Final (SRI 9999999999999).</summary>
    ConsumidorFinal = 4,
}
