namespace EcuNexo.Core.Pricing;

/// <summary>
/// Tipo de objetivo al que aplica (o excluye) una regla/esquema de volumen.
/// </summary>
public enum VolumeRuleTargetType
{
    /// <summary>Todo el catálogo del tenant (referencia canónica "*").</summary>
    AllItems = 0,

    /// <summary>Todos los productos pertenecientes a una categoría.</summary>
    Category = 1,

    /// <summary>Todas las variantes de una matriz padre.</summary>
    Matrix = 2,

    /// <summary>Un producto estándar específico.</summary>
    Product = 3,

    /// <summary>Una variante específica.</summary>
    Variant = 4,
}
