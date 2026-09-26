namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Snapshot de precios resuelto por el motor para una línea de pedido. Congela lista, precio de
/// lista, impuesto, total y reglas aplicadas para que el histórico nunca se recalcule.
/// </summary>
public sealed record EcommerceItemPricingSnapshot(
    Guid PriceListId,
    decimal ListPrice,
    decimal TaxAmount,
    decimal TotalAmount,
    string? AppliedRulesJson);
