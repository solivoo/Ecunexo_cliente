namespace EcuNexo.Core.Pricing;

/// <summary>
/// Modo en que se acumulan las cantidades del carrito para evaluar un esquema de volumen.
/// </summary>
public enum VolumeGroupingMode
{
    /// <summary>Evalúa cada línea (SKU) por separado.</summary>
    PerLine = 0,

    /// <summary>Suma cantidades de todas las variantes que comparten la misma matriz padre.</summary>
    PerMatrix = 1,

    /// <summary>Suma cantidades de todas las líneas que coinciden con el alcance del esquema (Mix &amp; Match).</summary>
    PerGroup = 2,
}
