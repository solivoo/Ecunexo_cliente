using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Purchases;

/// <summary>
/// Catálogo maestro de tipos de gasto y sustentación tributaria de compras (SRI Ecuador).
/// Mapea la compra a los códigos oficiales del ATS (Tabla 5 del SRI).
/// </summary>
public sealed class ExpenseType : Entity<Guid>, ITenantEntity, IAuditable
{
    public const int CodeMaxLength = 50;
    public const int NameMaxLength = 200;
    public const int DescriptionMaxLength = 500;
    public const int SriSustentoCodeMaxLength = 2;

    private ExpenseType()
    {
    }

    public Guid TenantId { get; private set; }

    /// <summary>Código nemotécnico interno (ej. GASTO_MERCADERIA, GASTO_PUBLICIDAD).</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Nombre descriptivo del gasto.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Descripción detallada o propósito contable del tipo de gasto.</summary>
    public string? Description { get; private set; }

    /// <summary>
    /// Código oficial de sustento tributario SRI ATS (Tabla 5).
    /// Ej: '01' = Crédito tributario IVA, '02' = Costo/Gasto Renta, '03' = Activo Fijo.
    /// </summary>
    public string SriSustentoCode { get; private set; } = "01";

    /// <summary>Indica si este tipo de gasto incrementa el inventario físico y kárdex.</summary>
    public bool AffectsInventory { get; private set; }

    /// <summary>Indica si es un gasto preconfigurado del sistema (semillero) o personalizado.</summary>
    public bool IsSystem { get; private set; }

    /// <summary>Código sugerido de retención en la fuente de Impuesto a la Renta (ej. 312, 343, 303, 320).</summary>
    public string? SuggestedRetentionCode { get; private set; }

    /// <summary>Porcentaje oficial de retención en la fuente de Impuesto a la Renta (ej. 2.00, 3.00, 10.00, 1.00).</summary>
    public decimal? RetentionPercentage { get; private set; }

    /// <summary>Fecha de inicio de vigencia de la tarifa según resolución SRI (ej. 2026-08-06).</summary>
    public DateOnly? ValidFrom { get; private set; }

    /// <summary>Fecha de fin de vigencia de la tarifa si fue derogada o modificada.</summary>
    public DateOnly? ValidUntil { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }

    public static Result<ExpenseType> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string sriSustentoCode = "01",
        bool affectsInventory = false,
        bool isSystem = false,
        string? suggestedRetentionCode = null,
        decimal? retentionPercentage = null,
        DateOnly? validFrom = null,
        DateOnly? validUntil = null,
        string? description = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.id.empty", "El Id del tipo de gasto es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.code.empty", "El código del tipo de gasto es obligatorio.", ErrorType.Validation));
        }

        var trimmedCode = code.Trim().ToUpperInvariant();
        if (trimmedCode.Length > CodeMaxLength)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.code.toolong", $"El código no puede superar los {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.name.empty", "El nombre del tipo de gasto es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.name.toolong", $"El nombre no puede superar los {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var trimmedSustento = string.IsNullOrWhiteSpace(sriSustentoCode) ? "01" : sriSustentoCode.Trim();
        if (trimmedSustento.Length > SriSustentoCodeMaxLength)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.sri_sustento.invalid", $"El código de sustento SRI no puede superar {SriSustentoCodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (retentionPercentage.HasValue && (retentionPercentage.Value < 0 || retentionPercentage.Value > 100))
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.retention_percentage.invalid", "El porcentaje de retención debe estar entre 0% y 100%.", ErrorType.Validation));
        }

        if (validFrom.HasValue && validUntil.HasValue && validFrom.Value > validUntil.Value)
        {
            return Result.Failure<ExpenseType>(new Error("expense_type.validity.invalid", "La fecha de inicio de vigencia no puede ser posterior a la fecha de fin.", ErrorType.Validation));
        }

        return new ExpenseType
        {
            Id = id,
            TenantId = tenantId,
            Code = trimmedCode,
            Name = trimmedName,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            SriSustentoCode = trimmedSustento,
            AffectsInventory = affectsInventory,
            IsSystem = isSystem,
            SuggestedRetentionCode = string.IsNullOrWhiteSpace(suggestedRetentionCode) ? null : suggestedRetentionCode.Trim(),
            RetentionPercentage = retentionPercentage,
            ValidFrom = validFrom,
            ValidUntil = validUntil,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        };
    }

    public Result Update(
        string name,
        string sriSustentoCode,
        bool affectsInventory,
        string? suggestedRetentionCode = null,
        decimal? retentionPercentage = null,
        DateOnly? validFrom = null,
        DateOnly? validUntil = null,
        string? description = null,
        string? code = null,
        bool? isActive = null,
        Guid? updatedBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("expense_type.name.empty", "El nombre del tipo de gasto es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure(new Error("expense_type.name.toolong", $"El nombre no puede superar los {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var trimmedSustento = string.IsNullOrWhiteSpace(sriSustentoCode) ? "01" : sriSustentoCode.Trim();
        if (trimmedSustento.Length > SriSustentoCodeMaxLength)
        {
            return Result.Failure(new Error("expense_type.sri_sustento.invalid", $"El código de sustento SRI no puede superar {SriSustentoCodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (retentionPercentage.HasValue && (retentionPercentage.Value < 0 || retentionPercentage.Value > 100))
        {
            return Result.Failure(new Error("expense_type.retention_percentage.invalid", "El porcentaje de retención debe estar entre 0% y 100%.", ErrorType.Validation));
        }

        if (validFrom.HasValue && validUntil.HasValue && validFrom.Value > validUntil.Value)
        {
            return Result.Failure(new Error("expense_type.validity.invalid", "La fecha de inicio de vigencia no puede ser posterior a la fecha de fin.", ErrorType.Validation));
        }

        if (!IsSystem && !string.IsNullOrWhiteSpace(code))
        {
            var trimmedCode = code.Trim().ToUpperInvariant();
            if (trimmedCode.Length > CodeMaxLength)
            {
                return Result.Failure(new Error("expense_type.code.toolong", $"El código no puede superar los {CodeMaxLength} caracteres.", ErrorType.Validation));
            }
            Code = trimmedCode;
        }

        Name = trimmedName;
        SriSustentoCode = trimmedSustento;
        AffectsInventory = affectsInventory;
        SuggestedRetentionCode = string.IsNullOrWhiteSpace(suggestedRetentionCode) ? null : suggestedRetentionCode.Trim();
        RetentionPercentage = retentionPercentage;
        ValidFrom = validFrom;
        ValidUntil = validUntil;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        if (isActive.HasValue)
        {
            IsActive = isActive.Value;
        }
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    public Result Activate(Guid? updatedBy = null)
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result Deactivate(Guid? updatedBy = null)
    {
        if (IsSystem)
        {
            return Result.Failure(new Error("expense_type.system.nodeactivate", "No se pueden desactivar tipos de gasto base del sistema.", ErrorType.Validation));
        }

        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result Delete()
    {
        if (IsSystem)
        {
            return Result.Failure(new Error("expense_type.system.nodelete", "No se pueden eliminar conceptos base del sistema SRI. Puedes desactivarlos si tu empresa no los utiliza.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
