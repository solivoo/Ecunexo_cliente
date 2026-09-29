namespace EcuNexo.Core.Logistics;

public sealed record ResolvedShippingOption(
    Guid RuleId,
    string Carrier,
    string Zone,
    string Name,
    decimal Price,
    decimal TaxRate,
    decimal TaxAmount,
    decimal TotalPrice,
    string? EstimatedDays,
    string? Notes,
    bool IsEligible,
    decimal? UnitsNeeded,
    bool IsRecommended);

public static class ShippingRateResolver
{
    /// <summary>
    /// Resuelve las opciones de envío disponibles y recomendadas según la zona, cantidad total de artículos y subtotal.
    /// </summary>
    public static IReadOnlyList<ResolvedShippingOption> Resolve(
        IEnumerable<ShippingRateRule> rules,
        string? targetZone,
        decimal totalQuantity,
        decimal orderAmount = 0m)
    {
        var normalizedZone = targetZone?.Trim();
        var relevantRules = rules
            .Where(r => r.IsActive && (string.IsNullOrEmpty(normalizedZone) || r.Zone.Equals("*", StringComparison.OrdinalIgnoreCase) || r.Zone.Equals(normalizedZone, StringComparison.OrdinalIgnoreCase)))
            .OrderBy(r => r.SortOrder)
            .ThenByDescending(r => r.MinQuantity)
            .ThenBy(r => r.Price)
            .ToList();

        if (relevantRules.Count == 0)
        {
            return Array.Empty<ResolvedShippingOption>();
        }

        var results = new List<ResolvedShippingOption>();

        // Primero encontrar las elegibles
        var eligibleRules = relevantRules
            .Where(r => r.Matches(normalizedZone, totalQuantity, orderAmount))
            .ToList();

        // La recomendada es la que tiene mayor especificidad de volumen (MinQuantity más alta que cumpla) o menor precio
        var recommended = eligibleRules
            .OrderByDescending(r => r.MinQuantity)
            .ThenBy(r => r.Price)
            .FirstOrDefault();

        foreach (var rule in relevantRules)
        {
            var isEligible = eligibleRules.Contains(rule);
            decimal? unitsNeeded = null;

            if (!isEligible && totalQuantity < rule.MinQuantity)
            {
                unitsNeeded = rule.MinQuantity - totalQuantity;
            }

            var taxAmount = decimal.Round(rule.Price * (rule.TaxRate / 100m), 2, MidpointRounding.AwayFromZero);
            var totalPrice = decimal.Round(rule.Price + taxAmount, 2, MidpointRounding.AwayFromZero);
            var isRec = recommended != null && rule.Id == recommended.Id;

            results.Add(new ResolvedShippingOption(
                RuleId: rule.Id,
                Carrier: rule.Carrier,
                Zone: rule.Zone,
                Name: rule.Name,
                Price: rule.Price,
                TaxRate: rule.TaxRate,
                TaxAmount: taxAmount,
                TotalPrice: totalPrice,
                EstimatedDays: rule.EstimatedDays,
                Notes: rule.Notes,
                IsEligible: isEligible,
                UnitsNeeded: unitsNeeded,
                IsRecommended: isRec));
        }

        return results
            .OrderByDescending(r => r.IsRecommended)
            .ThenByDescending(r => r.IsEligible)
            .ThenBy(r => r.Price)
            .ToList();
    }
}
