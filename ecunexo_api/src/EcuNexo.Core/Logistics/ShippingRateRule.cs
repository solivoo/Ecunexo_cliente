using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Regla o celda de la matriz de tarifas de envío por transportista, zona geográfica y volumen/unidades.
/// </summary>
public sealed class ShippingRateRule : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int CarrierMaxLength = 80;
    public const int ZoneMaxLength = 80;
    public const int NameMaxLength = 120;
    public const int EstimatedDaysMaxLength = 50;
    public const int NotesMaxLength = 300;

    private ShippingRateRule()
    {
        Carrier = string.Empty;
        Zone = string.Empty;
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    /// <summary>
    /// Transportista o modalidad (ej: "Local", "Servientrega", "Cooperativa", "Tramaco").
    /// </summary>
    public string Carrier { get; private set; }

    /// <summary>
    /// Zona de destino (ej: "Local", "Provincia", "Galapagos", "Oriente").
    /// </summary>
    public string Zone { get; private set; }

    /// <summary>
    /// Nombre visible de la opción (ej: "Servientrega Nacional", "Cooperativa a partir de 36u").
    /// </summary>
    public string Name { get; private set; }

    /// <summary>
    /// Cantidad mínima de artículos para calificar a esta tarifa (ej: 1, 36).
    /// </summary>
    public decimal MinQuantity { get; private set; }

    /// <summary>
    /// Cantidad máxima de artículos permitidos (null = sin límite superior).
    /// </summary>
    public decimal? MaxQuantity { get; private set; }

    /// <summary>
    /// Monto mínimo del pedido (subtotal) para calificar (opcional).
    /// </summary>
    public decimal? MinOrderAmount { get; private set; }

    /// <summary>
    /// Precio / tarifa fija del flete antes de impuestos.
    /// </summary>
    public decimal Price { get; private set; }

    /// <summary>
    /// Tarifa porcentual de IVA aplicable para facturación electrónica (ej: 15 para 15%, 0 para 0%).
    /// </summary>
    public decimal TaxRate { get; private set; }

    /// <summary>
    /// Tiempo estimado de entrega (ej: "24h", "24-48 horas", "Mismo día").
    /// </summary>
    public string? EstimatedDays { get; private set; }

    /// <summary>
    /// Notas adicionales o condiciones (ej: "Entrega en terminal terrestre").
    /// </summary>
    public string? Notes { get; private set; }

    /// <summary>
    /// Orden de visualización o prioridad.
    /// </summary>
    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public Guid? ShippingZoneId { get; private set; }

    public ShippingZone? ShippingZone { get; private set; }

    public Guid? ShippingMethodId { get; private set; }

    public ShippingMethod? ShippingMethod { get; private set; }

    public static Result<ShippingRateRule> Create(
        Guid id,
        Guid tenantId,
        string carrier,
        string zone,
        string name,
        decimal price,
        decimal minQuantity = 1m,
        decimal? maxQuantity = null,
        decimal? minOrderAmount = null,
        decimal taxRate = 0m,
        string? estimatedDays = null,
        string? notes = null,
        int sortOrder = 0,
        Guid? createdBy = null,
        Guid? shippingZoneId = null,
        Guid? shippingMethodId = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<ShippingRateRule>(
                new Error("logistics.shipping_rule.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var validationResult = Validate(carrier, zone, name, price, minQuantity, maxQuantity, minOrderAmount, taxRate, estimatedDays, notes);
        if (validationResult.IsFailure)
        {
            return Result.Failure<ShippingRateRule>(validationResult.Error!);
        }

        var rule = new ShippingRateRule
        {
            Id = id,
            TenantId = tenantId,
            Carrier = carrier.Trim(),
            Zone = zone.Trim(),
            Name = name.Trim(),
            Price = decimal.Round(price, 2, MidpointRounding.AwayFromZero),
            MinQuantity = Math.Max(1m, decimal.Round(minQuantity, 4, MidpointRounding.AwayFromZero)),
            MaxQuantity = maxQuantity.HasValue ? decimal.Round(maxQuantity.Value, 4, MidpointRounding.AwayFromZero) : null,
            MinOrderAmount = minOrderAmount.HasValue ? Math.Max(0m, decimal.Round(minOrderAmount.Value, 2, MidpointRounding.AwayFromZero)) : null,
            TaxRate = Math.Max(0m, decimal.Round(taxRate, 2, MidpointRounding.AwayFromZero)),
            EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            SortOrder = sortOrder,
            ShippingZoneId = shippingZoneId,
            ShippingMethodId = shippingMethodId,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };

        return Result.Success(rule);
    }

    public Result Update(
        string carrier,
        string zone,
        string name,
        decimal price,
        decimal minQuantity,
        decimal? maxQuantity,
        decimal? minOrderAmount,
        decimal taxRate,
        string? estimatedDays,
        string? notes,
        int sortOrder,
        bool? isActive,
        Guid? updatedBy,
        Guid? shippingZoneId = null,
        Guid? shippingMethodId = null)
    {
        var validationResult = Validate(carrier, zone, name, price, minQuantity, maxQuantity, minOrderAmount, taxRate, estimatedDays, notes);
        if (validationResult.IsFailure)
        {
            return validationResult;
        }

        Carrier = carrier.Trim();
        Zone = zone.Trim();
        Name = name.Trim();
        Price = decimal.Round(price, 2, MidpointRounding.AwayFromZero);
        MinQuantity = Math.Max(1m, decimal.Round(minQuantity, 4, MidpointRounding.AwayFromZero));
        MaxQuantity = maxQuantity.HasValue ? decimal.Round(maxQuantity.Value, 4, MidpointRounding.AwayFromZero) : null;
        MinOrderAmount = minOrderAmount.HasValue ? Math.Max(0m, decimal.Round(minOrderAmount.Value, 2, MidpointRounding.AwayFromZero)) : null;
        TaxRate = Math.Max(0m, decimal.Round(taxRate, 2, MidpointRounding.AwayFromZero));
        EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        SortOrder = sortOrder;
        ShippingZoneId = shippingZoneId ?? ShippingZoneId;
        ShippingMethodId = shippingMethodId ?? ShippingMethodId;

        if (isActive.HasValue)
        {
            IsActive = isActive.Value;
        }

        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    public void Deactivate(Guid? updatedBy = null)
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void Activate(Guid? updatedBy = null)
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// Verifica si un pedido con cantidad total y subtotal califica para esta regla.
    /// </summary>
    public bool Matches(string? targetZone, decimal totalQuantity, decimal orderAmount = 0m)
    {
        if (!IsActive)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(targetZone)
            && !Zone.Equals("*", StringComparison.OrdinalIgnoreCase)
            && !Zone.Equals(targetZone.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (totalQuantity < MinQuantity)
        {
            return false;
        }

        if (MaxQuantity.HasValue && totalQuantity > MaxQuantity.Value)
        {
            return false;
        }

        if (MinOrderAmount.HasValue && orderAmount < MinOrderAmount.Value)
        {
            return false;
        }

        return true;
    }

    private static Result Validate(
        string carrier,
        string zone,
        string name,
        decimal price,
        decimal minQuantity,
        decimal? maxQuantity,
        decimal? minOrderAmount,
        decimal taxRate,
        string? estimatedDays,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(carrier))
        {
            return Result.Failure(new Error("logistics.shipping_rule.carrier.required", "El transportista es obligatorio.", ErrorType.Validation));
        }

        if (carrier.Trim().Length > CarrierMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_rule.carrier.length", $"El transportista no puede superar {CarrierMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(zone))
        {
            return Result.Failure(new Error("logistics.shipping_rule.zone.required", "La zona de destino es obligatoria.", ErrorType.Validation));
        }

        if (zone.Trim().Length > ZoneMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_rule.zone.length", $"La zona no puede superar {ZoneMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("logistics.shipping_rule.name.required", "El nombre de la tarifa es obligatorio.", ErrorType.Validation));
        }

        if (name.Trim().Length > NameMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_rule.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        if (price < 0m)
        {
            return Result.Failure(new Error("logistics.shipping_rule.price.range", "El precio del envío no puede ser negativo.", ErrorType.Validation));
        }

        if (minQuantity < 1m)
        {
            return Result.Failure(new Error("logistics.shipping_rule.min_quantity.range", "La cantidad mínima debe ser al menos 1 unidad.", ErrorType.Validation));
        }

        if (maxQuantity.HasValue && maxQuantity.Value < minQuantity)
        {
            return Result.Failure(new Error("logistics.shipping_rule.max_quantity.range", "La cantidad máxima no puede ser menor a la mínima.", ErrorType.Validation));
        }

        if (minOrderAmount.HasValue && minOrderAmount.Value < 0m)
        {
            return Result.Failure(new Error("logistics.shipping_rule.min_order_amount.range", "El monto mínimo de orden no puede ser negativo.", ErrorType.Validation));
        }

        if (taxRate < 0m || taxRate > 100m)
        {
            return Result.Failure(new Error("logistics.shipping_rule.tax_rate.range", "La tasa de IVA debe estar entre 0% y 100%.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(estimatedDays) && estimatedDays.Trim().Length > EstimatedDaysMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_rule.estimated_days.length", $"El tiempo estimado no puede superar {EstimatedDaysMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(notes) && notes.Trim().Length > NotesMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_rule.notes.length", $"Las notas no pueden superar {NotesMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
