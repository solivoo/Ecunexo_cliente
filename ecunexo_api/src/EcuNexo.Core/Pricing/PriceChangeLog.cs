using EcuNexo.Core.Common;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Bitácora append-only de cambios de precio. Registra quién cambió, cuándo, precio anterior,
/// precio nuevo, lista, producto y vigencia afectada.
/// </summary>
public sealed class PriceChangeLog : Entity<Guid>
{
    public const int ReasonMaxLength = 200;

    private PriceChangeLog()
    {
        Reason = null;
    }

    public Guid TenantId { get; private set; }

    public Guid PriceListId { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public decimal? PreviousPrice { get; private set; }

    public decimal? NewPrice { get; private set; }

    public DateOnly ValidFrom { get; private set; }

    public DateOnly? ValidTo { get; private set; }

    public string? Reason { get; private set; }

    public Guid? ChangedBy { get; private set; }

    public DateTimeOffset ChangedAt { get; private set; }

    public static Result<PriceChangeLog> Create(
        Guid id,
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        decimal? previousPrice,
        decimal? newPrice,
        DateOnly validFrom,
        DateOnly? validTo,
        string? reason,
        Guid? changedBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty || priceListId == Guid.Empty || catalogItemId == Guid.Empty)
        {
            return Result.Failure<PriceChangeLog>(
                new Error("catalog.pricing.history.keys.invalid", "El identificador, la empresa, la lista y el ítem son obligatorios.", ErrorType.Validation));
        }

        if (previousPrice is < 0m || newPrice is < 0m)
        {
            return Result.Failure<PriceChangeLog>(
                new Error("catalog.pricing.history.price.range", "Los precios del historial no pueden ser negativos.", ErrorType.Validation));
        }

        if (validTo.HasValue && validTo.Value < validFrom)
        {
            return Result.Failure<PriceChangeLog>(
                new Error("catalog.pricing.history.validity", "La vigencia del historial no es válida.", ErrorType.Validation));
        }

        var normalizedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (normalizedReason is not null && normalizedReason.Length > ReasonMaxLength)
        {
            return Result.Failure<PriceChangeLog>(
                new Error("catalog.pricing.history.reason.length", $"El motivo no puede superar {ReasonMaxLength} caracteres.", ErrorType.Validation));
        }

        return new PriceChangeLog
        {
            Id = id,
            TenantId = tenantId,
            PriceListId = priceListId,
            CatalogItemId = catalogItemId,
            PreviousPrice = previousPrice,
            NewPrice = newPrice,
            ValidFrom = validFrom,
            ValidTo = validTo,
            Reason = normalizedReason,
            ChangedBy = changedBy,
            ChangedAt = DateTimeOffset.UtcNow,
        };
    }
}
