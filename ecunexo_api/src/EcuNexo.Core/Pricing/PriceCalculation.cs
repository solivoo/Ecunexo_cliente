namespace EcuNexo.Core.Pricing;

/// <summary>Resultado puro del cálculo de precio para una línea: sin persistencia ni tenant.</summary>
public sealed record PriceCalculation(
    decimal ListPrice,
    decimal UnitPrice,
    string? TierLabel,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal NetPrice,
    decimal TaxableBase,
    decimal TaxAmount,
    decimal FinalPrice,
    decimal TaxRate,
    bool PricesIncludeTax,
    IReadOnlyList<string> AppliedRules);
