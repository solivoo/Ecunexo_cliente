using EcuNexo.Core.Ecommerce;

namespace EcuNexo.Business.Storefront;

/// <summary>Producto con más "me gusta" en el período consultado.</summary>
public sealed record StorefrontLikeTopProductDto(
    Guid CatalogItemId,
    string Name,
    int LikeCount);

/// <summary>Punto de la serie diaria de likes (fecha UTC calendario).</summary>
public sealed record StorefrontLikeDailyPointDto(
    DateOnly Date,
    int Count);

/// <summary>Métricas de likes de la vitrina para el panel administrativo.</summary>
public sealed record StorefrontLikeMetricsDto(
    int TotalLikes,
    IReadOnlyList<StorefrontLikeTopProductDto> TopProducts,
    IReadOnlyList<StorefrontLikeDailyPointDto> Daily);

public interface IStorefrontProductLikeRepository
{
    Task<bool> ExistsAsync(
        Guid tenantId,
        Guid catalogItemId,
        string visitorId,
        CancellationToken ct = default);

    Task AddAsync(StorefrontProductLike like, CancellationToken ct = default);

    /// <summary>Elimina el like si existe. Devuelve <c>true</c> cuando había algo que borrar.</summary>
    Task<bool> RemoveAsync(
        Guid tenantId,
        Guid catalogItemId,
        string visitorId,
        CancellationToken ct = default);

    Task<IReadOnlyDictionary<Guid, int>> CountByItemIdsAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> itemIds,
        CancellationToken ct = default);

    Task<int> CountForItemAsync(
        Guid tenantId,
        Guid catalogItemId,
        CancellationToken ct = default);

    /// <summary>
    /// Top de productos más gustados y serie diaria de likes dentro de la ventana [fromUtc, toUtc].
    /// La serie incluye todos los días del rango (conteo 0 cuando no hubo likes).
    /// </summary>
    Task<StorefrontLikeMetricsDto> ListMetricsAsync(
        Guid tenantId,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        int top,
        CancellationToken ct = default);
}
