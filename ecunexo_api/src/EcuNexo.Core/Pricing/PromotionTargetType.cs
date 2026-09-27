namespace EcuNexo.Core.Pricing;

/// <summary>Alcance al que aplica una promoción.</summary>
public enum PromotionTargetType
{
    Product = 0,
    Variant = 1,

    /// <summary>Aplica a todo el catálogo de la tienda, incluidos los productos nuevos. Referencia canónica: "*".</summary>
    AllItems = 2,
}
