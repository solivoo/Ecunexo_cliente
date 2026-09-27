namespace EcuNexo.Business.Storefront;

/// <summary>Fila mínima para calcular métricas de likes (producto, nombre y fecha).</summary>
public sealed record StorefrontLikeRow(
    Guid CatalogItemId,
    string Name,
    DateTimeOffset CreatedAt);

/// <summary>Agregación pura de likes: total, top de productos y serie diaria (días sin likes = 0).</summary>
public static class StorefrontLikeMetricsCalculator
{
    public static StorefrontLikeMetricsDto Build(
        IReadOnlyCollection<StorefrontLikeRow> rows,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        int top)
    {
        var take = top > 0 ? top : 5;

        var topProducts = rows
            .GroupBy(row => new { row.CatalogItemId, row.Name })
            .Select(group => new StorefrontLikeTopProductDto(
                group.Key.CatalogItemId,
                group.Key.Name,
                group.Count()))
            .OrderByDescending(product => product.LikeCount)
            .ThenBy(product => product.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(product => product.CatalogItemId)
            .Take(take)
            .ToList();

        var countsByDay = rows
            .GroupBy(row => DateOnly.FromDateTime(row.CreatedAt.UtcDateTime))
            .ToDictionary(group => group.Key, group => group.Count());

        var daily = new List<StorefrontLikeDailyPointDto>();
        var firstDay = DateOnly.FromDateTime(fromUtc.UtcDateTime);
        var lastDay = DateOnly.FromDateTime(toUtc.UtcDateTime);
        for (var day = firstDay; day <= lastDay; day = day.AddDays(1))
        {
            daily.Add(new StorefrontLikeDailyPointDto(
                day,
                countsByDay.TryGetValue(day, out var count) ? count : 0));
        }

        return new StorefrontLikeMetricsDto(rows.Count, topProducts, daily);
    }
}
