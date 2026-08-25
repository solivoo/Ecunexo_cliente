namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Nivel de servicio dentro de un módulo de producto contratado.
/// Los límites concretos de cada tier están definidos en <see cref="ModuleTierCatalog"/>.
/// </summary>
public enum ModuleTier : short
{
    /// <summary>Perfil de entrada — PyME con necesidades básicas.</summary>
    Small = 0,

    /// <summary>Perfil medio — negocio en crecimiento.</summary>
    Medium = 1,

    /// <summary>Perfil avanzado — operación consolidada.</summary>
    Big = 2,

    /// <summary>Sin restricciones — corporativo o a la carta.</summary>
    Enterprise = 3,
}
