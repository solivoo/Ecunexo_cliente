using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

public sealed record CartLineInput(
    Guid LineId,
    Guid CatalogItemId,
    Guid? ParentId,
    Guid? CategoryId,
    decimal ListPrice,
    decimal Quantity,
    IReadOnlyList<QuantityTier> LineTiers,
    VolumeDiscountScheme? LineScheme,
    IReadOnlyList<Promotion> Promotions,
    decimal TaxRate,
    bool PricesIncludeTax);

public sealed record CartLineCalculation(
    Guid LineId,
    Guid CatalogItemId,
    decimal ListPrice,
    decimal UnitPrice,
    decimal Quantity,
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

public sealed record CartCalculation(
    IReadOnlyList<CartLineCalculation> Lines,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal NetPrice,
    decimal TaxableBase,
    decimal TaxAmount,
    decimal FinalPrice,
    IReadOnlyList<string> AppliedRules);

/// <summary>
/// Motor único de cálculo agrupado para carrito/pedido (Capa 4).
/// Resuelve tarifa base, reglas de volumen agrupadas (PerLine, PerMatrix, PerGroup),
/// mínimos obligatorios de grupo, prorrateo exacto de paquetes (PackagePrice), promociones e IVA.
/// </summary>
public static class CartPriceCalculator
{
    public static Result<CartCalculation> Calculate(
        IReadOnlyList<CartLineInput> lines,
        IReadOnlyList<VolumeDiscountScheme> groupRules)
    {
        if (lines.Count == 0)
        {
            return Result.Success(new CartCalculation([], 0m, 0m, 0m, 0m, 0m, 0m, []));
        }

        foreach (var line in lines)
        {
            if (line.ListPrice < 0)
            {
                return Result.Failure<CartCalculation>(
                    new Error("catalog.pricing.price.range", "El precio de lista no puede ser negativo.", ErrorType.Validation));
            }

            if (line.Quantity <= 0)
            {
                return Result.Failure<CartCalculation>(
                    new Error("catalog.pricing.quantity.range", "La cantidad debe ser mayor que cero.", ErrorType.Validation));
            }
        }

        // 1. Pre-resolver tramos manuales por línea (tienen precedencia absoluta sobre esquemas).
        var manualTierByLine = new Dictionary<Guid, QuantityTier>();
        foreach (var line in lines)
        {
            var tier = line.LineTiers
                .Where(t => t.IsActive && t.Includes(line.Quantity))
                .OrderByDescending(t => t.QuantityFrom)
                .FirstOrDefault();

            if (tier is not null)
            {
                manualTierByLine[line.LineId] = tier;
            }
        }

        // 2. Resolver reglas agrupadas activas por prioridad descendente.
        var activeGroupRules = groupRules
            .Where(r => r.IsActive && r.GroupingMode != VolumeGroupingMode.PerLine)
            .OrderByDescending(r => r.Priority)
            .ThenBy(r => r.Name, StringComparer.Ordinal)
            .ToList();

        var assignedLineDiscounts = new Dictionary<Guid, (decimal Discount, string? TierLabel, string RuleTag)>();

        foreach (var rule in activeGroupRules)
        {
            var eligibleLines = lines
                .Where(l => !manualTierByLine.ContainsKey(l.LineId) && !assignedLineDiscounts.ContainsKey(l.LineId))
                .Where(l => rule.MatchesItem(l.CatalogItemId, l.ParentId, l.CategoryId))
                .ToList();

            if (eligibleLines.Count == 0)
            {
                continue;
            }

            IEnumerable<IGrouping<Guid, CartLineInput>> groups = rule.GroupingMode == VolumeGroupingMode.PerMatrix
                ? eligibleLines.GroupBy(l => l.ParentId ?? l.CatalogItemId)
                : eligibleLines.GroupBy(_ => rule.Id);

            foreach (var group in groups)
            {
                var groupLines = group.ToList();
                var totalQty = groupLines.Sum(l => l.Quantity);

                if (rule.EnforceMinPurchase && rule.MinGroupQuantity.HasValue && totalQty < rule.MinGroupQuantity.Value)
                {
                    return Result.Failure<CartCalculation>(
                        new Error(
                            "catalog.pricing.group_min_quantity",
                            $"Compra requiere un mínimo de {rule.MinGroupQuantity.Value:0.####} unidades (actual: {totalQty:0.####}).",
                            ErrorType.Validation));
                }

                if (rule.MinGroupQuantity.HasValue && totalQty < rule.MinGroupQuantity.Value)
                {
                    continue;
                }

                var schemeTier = rule.Tiers
                    .Where(t => t.IsActive && t.Includes(totalQty))
                    .OrderByDescending(t => t.QuantityFrom)
                    .FirstOrDefault();

                if (schemeTier is null)
                {
                    continue;
                }

                var tierLabel = schemeTier.QuantityTo is null
                    ? $"{schemeTier.QuantityFrom:0.####}+"
                    : $"{schemeTier.QuantityFrom:0.####} - {schemeTier.QuantityTo.Value:0.####}";

                ApplyGroupTierDiscount(rule, schemeTier, tierLabel, groupLines, totalQty, assignedLineDiscounts);
            }
        }

        // 3. Calcular cada línea final (tramo manual / regla agrupada / esquema de línea + promociones + IVA).
        var resultLines = new List<CartLineCalculation>(lines.Count);
        var cartRules = new List<string>();

        foreach (var line in lines)
        {
            var appliedRules = new List<string>();
            decimal unitPrice = line.ListPrice;
            string? tierLabel = null;
            decimal volumeDiscount = 0m;

            if (manualTierByLine.TryGetValue(line.LineId, out var manualTier))
            {
                unitPrice = manualTier.UnitPrice;
                tierLabel = manualTier.QuantityTo is null
                    ? $"{manualTier.QuantityFrom:0.####}+"
                    : $"{manualTier.QuantityFrom:0.####} - {manualTier.QuantityTo.Value:0.####}";
                appliedRules.Add($"ESCALA_{manualTier.QuantityFrom:0.####}");
            }
            else if (assignedLineDiscounts.TryGetValue(line.LineId, out var groupDiscount))
            {
                volumeDiscount = groupDiscount.Discount;
                tierLabel = groupDiscount.TierLabel;
                appliedRules.Add(groupDiscount.RuleTag);
            }
            else if (line.LineScheme is { IsActive: true })
            {
                var lineCalc = PriceCalculator.Calculate(
                    line.ListPrice,
                    line.Quantity,
                    [],
                    line.Promotions,
                    line.TaxRate,
                    line.PricesIncludeTax,
                    line.LineScheme);
                if (lineCalc.IsFailure)
                {
                    return Result.Failure<CartCalculation>(lineCalc.Error!);
                }

                var v = lineCalc.Value!;
                resultLines.Add(new CartLineCalculation(
                    line.LineId,
                    line.CatalogItemId,
                    v.ListPrice,
                    v.UnitPrice,
                    line.Quantity,
                    v.TierLabel,
                    v.Subtotal,
                    v.DiscountAmount,
                    v.NetPrice,
                    v.TaxableBase,
                    v.TaxAmount,
                    v.FinalPrice,
                    v.TaxRate,
                    v.PricesIncludeTax,
                    v.AppliedRules));
                cartRules.AddRange(v.AppliedRules);
                continue;
            }

            // Sin esquema por línea o ya resuelto por tramo manual/regla agrupada:
            var singleCalc = PriceCalculator.Calculate(
                unitPrice,
                line.Quantity,
                [],
                line.Promotions,
                line.TaxRate,
                line.PricesIncludeTax,
                volumeScheme: null);
            if (singleCalc.IsFailure)
            {
                return Result.Failure<CartCalculation>(singleCalc.Error!);
            }

            var baseCalc = singleCalc.Value!;
            if (volumeDiscount > 0m)
            {
                var subtotal = RoundMoney(unitPrice * line.Quantity);
                var discountAmount = Math.Min(RoundMoney(volumeDiscount + baseCalc.DiscountAmount), subtotal);
                var netPrice = subtotal - discountAmount;
                var (taxableBase, taxAmount, finalPrice) = SplitTax(netPrice, line.TaxRate, line.PricesIncludeTax);
                appliedRules.AddRange(baseCalc.AppliedRules);

                resultLines.Add(new CartLineCalculation(
                    line.LineId,
                    line.CatalogItemId,
                    line.ListPrice,
                    unitPrice,
                    line.Quantity,
                    tierLabel,
                    subtotal,
                    discountAmount,
                    netPrice,
                    taxableBase,
                    taxAmount,
                    finalPrice,
                    line.TaxRate,
                    line.PricesIncludeTax,
                    appliedRules));
                cartRules.AddRange(appliedRules);
            }
            else
            {
                appliedRules.AddRange(baseCalc.AppliedRules);
                resultLines.Add(new CartLineCalculation(
                    line.LineId,
                    line.CatalogItemId,
                    line.ListPrice,
                    unitPrice,
                    line.Quantity,
                    tierLabel,
                    baseCalc.Subtotal,
                    baseCalc.DiscountAmount,
                    baseCalc.NetPrice,
                    baseCalc.TaxableBase,
                    baseCalc.TaxAmount,
                    baseCalc.FinalPrice,
                    line.TaxRate,
                    line.PricesIncludeTax,
                    appliedRules));
                cartRules.AddRange(appliedRules);
            }
        }

        return Result.Success(new CartCalculation(
            resultLines,
            resultLines.Sum(l => l.Subtotal),
            resultLines.Sum(l => l.DiscountAmount),
            resultLines.Sum(l => l.NetPrice),
            resultLines.Sum(l => l.TaxableBase),
            resultLines.Sum(l => l.TaxAmount),
            resultLines.Sum(l => l.FinalPrice),
            cartRules.Distinct(StringComparer.Ordinal).ToList()));
    }

    private static void ApplyGroupTierDiscount(
        VolumeDiscountScheme rule,
        VolumeDiscountTier schemeTier,
        string tierLabel,
        List<CartLineInput> groupLines,
        decimal totalQty,
        Dictionary<Guid, (decimal Discount, string? TierLabel, string RuleTag)> assigned)
    {
        if (rule.Type == VolumeDiscountSchemeType.PackagePrice)
        {
            var packageTotal = RoundMoney(schemeTier.Value * (totalQty / schemeTier.QuantityFrom));
            var tag = $"PAQUETE_{rule.Name}_{schemeTier.QuantityFrom:0.####}_${schemeTier.Value:0.00}";
            var remainingTarget = packageTotal;

            for (var i = 0; i < groupLines.Count; i++)
            {
                var line = groupLines[i];
                var lineSubtotal = RoundMoney(line.ListPrice * line.Quantity);
                var lineTarget = i == groupLines.Count - 1
                    ? remainingTarget
                    : RoundMoney(packageTotal * (line.Quantity / totalQty));
                remainingTarget -= lineTarget;

                var discount = Math.Max(0m, lineSubtotal - lineTarget);
                assigned[line.LineId] = (discount, tierLabel, tag);
            }
            return;
        }

        foreach (var line in groupLines)
        {
            var lineSubtotal = RoundMoney(line.ListPrice * line.Quantity);
            var (discount, tag) = rule.Type switch
            {
                VolumeDiscountSchemeType.Percentage => (
                    RoundMoney(lineSubtotal * schemeTier.Value / 100m),
                    $"ESQUEMA_GRUPO_{rule.Name}_{schemeTier.QuantityFrom:0.####}_{schemeTier.Value:0.##}%"),
                VolumeDiscountSchemeType.FixedAmount => (
                    RoundMoney(schemeTier.Value * line.Quantity),
                    $"ESQUEMA_GRUPO_{rule.Name}_{schemeTier.QuantityFrom:0.####}_${schemeTier.Value:0.00}"),
                VolumeDiscountSchemeType.FixedPrice => (
                    schemeTier.Value < line.ListPrice ? RoundMoney((line.ListPrice - schemeTier.Value) * line.Quantity) : 0m,
                    $"ESQUEMA_GRUPO_{rule.Name}_{schemeTier.QuantityFrom:0.####}_PVP${schemeTier.Value:0.00}"),
                _ => (0m, string.Empty),
            };

            assigned[line.LineId] = (discount, tierLabel, tag);
        }
    }

    private static (decimal TaxableBase, decimal TaxAmount, decimal FinalPrice) SplitTax(
        decimal netPrice,
        decimal taxRate,
        bool pricesIncludeTax)
    {
        if (pricesIncludeTax && taxRate > 0m)
        {
            var taxableBase = RoundMoney(netPrice / (1m + taxRate));
            return (taxableBase, netPrice - taxableBase, netPrice);
        }

        var taxAmount = RoundMoney(netPrice * taxRate);
        return (netPrice, taxAmount, netPrice + taxAmount);
    }

    private static decimal RoundMoney(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
