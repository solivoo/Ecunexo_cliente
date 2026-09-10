namespace EcuNexo.Core.Customers;

/// <summary>
/// Clasificación funcional y comercial del cliente en la plataforma EcuNexo.
/// Permite segmentar operaciones de taller, facturación, distribución y auditoría B2B.
/// </summary>
public enum CustomerType
{
    /// <summary>Cliente corporativo o marca fabricante aliada (ej. Whirlpool, Mabe, Samsung).</summary>
    CorporativoB2B = 1,

    /// <summary>Persona natural (cliente directo o usuario particular del servicio).</summary>
    PersonaNatural = 2,

    /// <summary>Distribuidor mayorista o comercializador de productos y partes.</summary>
    DistribuidorMayorista = 3,

    /// <summary>Taller técnico aliado o subcontratista de reparaciones.</summary>
    TallerAliado = 4,

    /// <summary>Consumidor final para ventas o servicios directos de mostrador.</summary>
    ConsumidorFinal = 5,

    /// <summary>Entidad del sector público u organismo gubernamental.</summary>
    InstitucionPublica = 6,
}
