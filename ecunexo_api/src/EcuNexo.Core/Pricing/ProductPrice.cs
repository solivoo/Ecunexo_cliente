using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Precio vigente de un ítem de catálogo (simple o variante) dentro de una lista. Cambiar un
/// precio no sobrescribe: se cierra la vigencia y se registra una fila nueva.
/// </summary>
public sealed class ProductPrice : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    private readonly List<QuantityTier> _tiers = [];

    private ProductPrice()
    {
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid PriceListId { get; private set; }

    public PriceList? PriceList { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public CatalogItem? CatalogItem { get; private set; }

    public decimal Price { get; private set; }

    public DateOnly ValidFrom { get; private set; }

    public DateOnly? ValidTo { get; private set; }

    public bool IsActive { get; private set; }

    public IReadOnlyList<QuantityTier> Tiers => _tiers.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<ProductPrice> Create(
        Guid id,
        Guid tenantId,
        Guid priceListId,
        Guid catalogItemId,
        decimal price,
        DateOnly validFrom,
        DateOnly? validTo,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty || priceListId == Guid.Empty || catalogItemId == Guid.Empty)
        {
            return Result.Failure<ProductPrice>(
                new Error("catalog.pricing.product_price.keys.invalid", "El identificador, la empresa, la lista y el ítem son obligatorios.", ErrorType.Validation));
        }

        var validation = Validate(price, validFrom, validTo);
        if (validation.IsFailure)
        {
            return Result.Failure<ProductPrice>(validation.Error!);
        }

        return new ProductPrice
        {
            Id = id,
            TenantId = tenantId,
            PriceListId = priceListId,
            CatalogItemId = catalogItemId,
            Price = NormalizePrice(price),
            ValidFrom = validFrom,
            ValidTo = validTo,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    /// <summary>Corrige el precio de la fila vigente. El cambio de precio comercial se hace cerrando vigencia.</summary>
    public Result ChangePrice(decimal price, Guid? updatedBy = null)
    {
        if (price < 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.price.range", "El precio no puede ser negativo.", ErrorType.Validation));
        }

        Price = NormalizePrice(price);
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetValidity(DateOnly validFrom, DateOnly? validTo, Guid? updatedBy = null)
    {
        var validation = Validate(Price, validFrom, validTo);
        if (validation.IsFailure)
        {
            return validation;
        }

        ValidFrom = validFrom;
        ValidTo = validTo;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result<QuantityTier> AddTier(
        Guid tierId,
        decimal quantityFrom,
        decimal? quantityTo,
        decimal unitPrice,
        Guid? createdBy = null)
    {
        var validation = QuantityTier.Validate(quantityFrom, quantityTo, unitPrice);
        if (validation.IsFailure)
        {
            return Result.Failure<QuantityTier>(validation.Error!);
        }

        var overlaps = _tiers.Any(t => t.IsActive && t.Overlaps(quantityFrom, quantityTo));
        if (overlaps)
        {
            return Result.Failure<QuantityTier>(
                new Error("catalog.pricing.tier.overlap", "La escala se superpone con otra escala activa del mismo precio.", ErrorType.Conflict));
        }

        var tierResult = QuantityTier.Create(tierId, Id, quantityFrom, quantityTo, unitPrice, createdBy);
        if (tierResult.IsFailure)
        {
            return Result.Failure<QuantityTier>(tierResult.Error!);
        }

        _tiers.Add(tierResult.Value!);
        Touch(createdBy);
        return Result.Success(tierResult.Value!);
    }

    public Result DeactivateTier(Guid tierId, Guid? updatedBy = null)
    {
        var tier = _tiers.FirstOrDefault(t => t.Id == tierId);
        if (tier is null)
        {
            return Result.Failure(
                new Error("catalog.pricing.tier.not_found", "La escala indicada no existe en este precio.", ErrorType.NotFound));
        }

        return tier.SetActive(false, updatedBy);
    }

    /// <summary>True cuando el precio puede usarse en la fecha indicada.</summary>
    public bool IsValidOn(DateOnly date) =>
        IsActive && ValidFrom <= date && (ValidTo is null || ValidTo >= date);

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result Validate(decimal price, DateOnly validFrom, DateOnly? validTo)
    {
        if (price < 0)
        {
            return Result.Failure(
                new Error("catalog.pricing.price.range", "El precio no puede ser negativo.", ErrorType.Validation));
        }

        if (validTo.HasValue && validTo.Value < validFrom)
        {
            return Result.Failure(
                new Error("catalog.pricing.price.validity", "La fecha final no puede ser anterior a la inicial.", ErrorType.Validation));
        }

        return Result.Success();
    }

    private static decimal NormalizePrice(decimal price) =>
        decimal.Round(price, 6, MidpointRounding.AwayFromZero);
}
