using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Customers;

namespace EcuNexo.Core.Repairs;

/// <summary>
/// Cliente corporativo, persona natural, distribuidor o aliado que contrata servicios o adquiere bienes en la plataforma EcuNexo.
/// </summary>
public sealed class Customer : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 200;
    public const int TaxIdMaxLength = 20;

    private Customer()
    {
    }

    public Guid TenantId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>RUC, Cédula o identificación fiscal/legal del cliente.</summary>
    public string? TaxId { get; private set; }

    /// <summary>Clasificación funcional del cliente (Corporativo, Persona Natural, Distribuidor, etc.).</summary>
    public CustomerType CustomerType { get; private set; } = CustomerType.CorporativoB2B;

    /// <summary>Tipo de identificación fiscal (RUC, Cédula, Pasaporte, Consumidor Final).</summary>
    public CustomerIdentificationType IdentificationType { get; private set; } = CustomerIdentificationType.Ruc;

    public string? ContactEmail { get; private set; }

    public string? ContactPhone { get; private set; }

    public string? Address { get; private set; }

    public string? ContactPerson { get; private set; }

    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<Customer> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? taxId = null,
        string? contactEmail = null,
        string? contactPhone = null,
        string? address = null,
        string? contactPerson = null,
        string? notes = null,
        CustomerType customerType = CustomerType.CorporativoB2B,
        CustomerIdentificationType identificationType = CustomerIdentificationType.Ruc)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.id.empty", "El Id del cliente es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Customer>(new Error("repairs.customer.name.empty", "El nombre o razón social del cliente es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<Customer>(new Error("repairs.customer.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(customerType))
        {
            return Result.Failure<Customer>(new Error("customer.type.invalid", "El tipo de cliente especificado no es válido.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(identificationType))
        {
            return Result.Failure<Customer>(new Error("customer.identification_type.invalid", "El tipo de identificación tributaria no es válido.", ErrorType.Validation));
        }

        var trimmedTaxId = taxId?.Trim();
        if (!string.IsNullOrEmpty(trimmedTaxId))
        {
            if (trimmedTaxId.Length > TaxIdMaxLength)
            {
                return Result.Failure<Customer>(new Error("customer.tax_id.toolong", $"La identificación no puede exceder {TaxIdMaxLength} caracteres.", ErrorType.Validation));
            }

            if (identificationType == CustomerIdentificationType.Cedula)
            {
                if (trimmedTaxId.Length != 10 || !trimmedTaxId.All(char.IsAsciiDigit))
                {
                    return Result.Failure<Customer>(new Error("customer.tax_id.cedula.invalid", "La cédula de identidad debe contener exactamente 10 dígitos numéricos.", ErrorType.Validation));
                }
            }
            else if (identificationType == CustomerIdentificationType.Ruc)
            {
                if (trimmedTaxId.Length != 13 || !trimmedTaxId.All(char.IsAsciiDigit))
                {
                    return Result.Failure<Customer>(new Error("customer.tax_id.ruc.invalid", "El RUC debe contener exactamente 13 dígitos numéricos.", ErrorType.Validation));
                }
            }
        }
        else if (identificationType == CustomerIdentificationType.ConsumidorFinal)
        {
            trimmedTaxId = "9999999999999";
        }

        return new Customer
        {
            Id = id,
            TenantId = tenantId,
            Name = trimmedName,
            TaxId = trimmedTaxId,
            CustomerType = customerType,
            IdentificationType = identificationType,
            ContactEmail = contactEmail?.Trim(),
            ContactPhone = contactPhone?.Trim(),
            Address = address?.Trim(),
            ContactPerson = contactPerson?.Trim(),
            Notes = notes?.Trim(),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result Update(
        string name,
        string? taxId,
        string? contactEmail,
        string? contactPhone,
        string? address,
        string? contactPerson,
        string? notes,
        CustomerType? customerType = null,
        CustomerIdentificationType? identificationType = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(new Error("repairs.customer.name.empty", "El nombre o razón social del cliente es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure(new Error("repairs.customer.name.toolong", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var resolvedType = customerType ?? CustomerType;
        if (!Enum.IsDefined(resolvedType))
        {
            return Result.Failure(new Error("customer.type.invalid", "El tipo de cliente especificado no es válido.", ErrorType.Validation));
        }

        var resolvedIdType = identificationType ?? IdentificationType;
        if (!Enum.IsDefined(resolvedIdType))
        {
            return Result.Failure(new Error("customer.identification_type.invalid", "El tipo de identificación tributaria no es válido.", ErrorType.Validation));
        }

        var trimmedTaxId = taxId?.Trim();
        if (!string.IsNullOrEmpty(trimmedTaxId))
        {
            if (trimmedTaxId.Length > TaxIdMaxLength)
            {
                return Result.Failure(new Error("customer.tax_id.toolong", $"La identificación no puede exceder {TaxIdMaxLength} caracteres.", ErrorType.Validation));
            }

            if (resolvedIdType == CustomerIdentificationType.Cedula)
            {
                if (trimmedTaxId.Length != 10 || !trimmedTaxId.All(char.IsAsciiDigit))
                {
                    return Result.Failure(new Error("customer.tax_id.cedula.invalid", "La cédula de identidad debe contener exactamente 10 dígitos numéricos.", ErrorType.Validation));
                }
            }
            else if (resolvedIdType == CustomerIdentificationType.Ruc)
            {
                if (trimmedTaxId.Length != 13 || !trimmedTaxId.All(char.IsAsciiDigit))
                {
                    return Result.Failure(new Error("customer.tax_id.ruc.invalid", "El RUC debe contener exactamente 13 dígitos numéricos.", ErrorType.Validation));
                }
            }
        }
        else if (resolvedIdType == CustomerIdentificationType.ConsumidorFinal)
        {
            trimmedTaxId = "9999999999999";
        }

        Name = trimmedName;
        TaxId = trimmedTaxId;
        CustomerType = resolvedType;
        IdentificationType = resolvedIdType;
        ContactEmail = contactEmail?.Trim();
        ContactPhone = contactPhone?.Trim();
        Address = address?.Trim();
        ContactPerson = contactPerson?.Trim();
        Notes = notes?.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;

        return Result.Success();
    }

    public Result ChangeClassification(CustomerType newType)
    {
        if (!Enum.IsDefined(newType))
        {
            return Result.Failure(new Error("customer.type.invalid", "El tipo de cliente especificado no es válido.", ErrorType.Validation));
        }

        CustomerType = newType;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public Result SetIdentification(CustomerIdentificationType newIdentificationType, string? newTaxId)
    {
        if (!Enum.IsDefined(newIdentificationType))
        {
            return Result.Failure(new Error("customer.identification_type.invalid", "El tipo de identificación tributaria no es válido.", ErrorType.Validation));
        }

        var trimmed = newTaxId?.Trim();
        if (!string.IsNullOrEmpty(trimmed))
        {
            if (trimmed.Length > TaxIdMaxLength)
            {
                return Result.Failure(new Error("customer.tax_id.toolong", $"La identificación no puede exceder {TaxIdMaxLength} caracteres.", ErrorType.Validation));
            }

            if (newIdentificationType == CustomerIdentificationType.Cedula)
            {
                if (trimmed.Length != 10 || !trimmed.All(char.IsAsciiDigit))
                {
                    return Result.Failure(new Error("customer.tax_id.cedula.invalid", "La cédula de identidad debe contener exactamente 10 dígitos numéricos.", ErrorType.Validation));
                }
            }
            else if (newIdentificationType == CustomerIdentificationType.Ruc)
            {
                if (trimmed.Length != 13 || !trimmed.All(char.IsAsciiDigit))
                {
                    return Result.Failure(new Error("customer.tax_id.ruc.invalid", "El RUC debe contener exactamente 13 dígitos numéricos.", ErrorType.Validation));
                }
            }
        }
        else if (newIdentificationType == CustomerIdentificationType.ConsumidorFinal)
        {
            trimmed = "9999999999999";
        }

        IdentificationType = newIdentificationType;
        TaxId = trimmed;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SoftDelete(Guid? deletedBy = null)
    {
        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = deletedBy;
    }
}
