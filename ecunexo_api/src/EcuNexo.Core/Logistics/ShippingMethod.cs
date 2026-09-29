using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Logistics;

/// <summary>
/// Método de envío, courier o transportista configurado por la empresa (ej: Servientrega, Cooperativa, Entrega Local, Tramaco).
/// </summary>
public sealed class ShippingMethod : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int CodeMaxLength = 40;
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 300;
    public const int EstimatedDaysMaxLength = 60;

    private ShippingMethod()
    {
        Code = string.Empty;
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public string? EstimatedDays { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<ShippingMethod> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description = null,
        string? estimatedDays = null,
        int sortOrder = 0,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<ShippingMethod>(
                new Error("logistics.shipping_method.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var validationResult = Validate(code, name, description, estimatedDays);
        if (validationResult.IsFailure)
        {
            return Result.Failure<ShippingMethod>(validationResult.Error!);
        }

        var method = new ShippingMethod
        {
            Id = id,
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim(),
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };

        return Result.Success(method);
    }

    public Result Update(
        string code,
        string name,
        string? description,
        string? estimatedDays,
        int sortOrder,
        bool? isActive,
        Guid? updatedBy)
    {
        var validationResult = Validate(code, name, description, estimatedDays);
        if (validationResult.IsFailure)
        {
            return validationResult;
        }

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        EstimatedDays = string.IsNullOrWhiteSpace(estimatedDays) ? null : estimatedDays.Trim();
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
        string? estimatedDays)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure(new Error("logistics.shipping_method.code.required", "El código del método de envío es obligatorio.", ErrorType.Validation));
        }

        if (code.Trim().Length > CodeMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_method.code.length", $"El código no puede superar {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("logistics.shipping_method.name.required", "El nombre del método de envío es obligatorio.", ErrorType.Validation));
        }

        if (name.Trim().Length > NameMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_method.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(description) && description.Trim().Length > DescriptionMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_method.description.length", $"La descripción no puede superar {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!string.IsNullOrWhiteSpace(estimatedDays) && estimatedDays.Trim().Length > EstimatedDaysMaxLength)
        {
            return Result.Failure(new Error("logistics.shipping_method.estimated_days.length", $"El tiempo estimado no puede superar {EstimatedDaysMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
