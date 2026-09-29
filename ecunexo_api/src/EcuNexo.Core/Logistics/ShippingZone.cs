using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Zona geográfica de cobertura y destino de envíos (ej: Local, Provincia, Galápagos, Oriente).
/// </summary>
public sealed class ShippingZone : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int CodeMaxLength = 40;
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 300;
    public const int ProvincesMaxLength = 500;

    private ShippingZone()
    {
        Code = string.Empty;
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    /// <summary>
    /// Lista de provincias o cantones comprendidos (texto libre o separado por comas).
    /// </summary>
    public string? Provinces { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<ShippingZone> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description = null,
        string? provinces = null,
        int sortOrder = 0,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<ShippingZone>(
                new Error("logistics.shipping_zone.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var validationResult = Validate(code, name, description, provinces);
        if (validationResult.IsFailure)
        {
            return Result.Failure<ShippingZone>(validationResult.Error!);
        }

        var zone = new ShippingZone
        {
            Id = id,
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Provinces = string.IsNullOrWhiteSpace(provinces) ? null : provinces.Trim(),
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };

        return Result.Success(zone);
    }

    public Result Update(
        string code,
        string name,
        string? description,
        string? provinces,
        int sortOrder,
        bool? isActive,
        Guid? updatedBy)
    {
        var validationResult = Validate(code, name, description, provinces);
        if (validationResult.IsFailure)
        {
            return validationResult;
        }

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Provinces = string.IsNullOrWhiteSpace(provinces) ? null : provinces.Trim();
        SortOrder = sortOrder;

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

    private static Result Validate(
        string code,
        string name,
        string? description,
        string? provinces)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure(new Error("logistics.shipping_zone.code.required", "El código de la zona es obligatorio.", ErrorType.Validation));
        }

        if (code.Trim().Length > CodeMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_zone.code.length", $"El código no puede superar {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("logistics.shipping_zone.name.required", "El nombre de la zona es obligatorio.", ErrorType.Validation));
        }

        if (name.Trim().Length > NameMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_zone.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(description) && description.Trim().Length > DescriptionMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_zone.description.length", $"La descripción no puede superar {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(provinces) && provinces.Trim().Length > ProvincesMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_zone.provinces.length", $"La lista de provincias no puede superar {ProvincesMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
