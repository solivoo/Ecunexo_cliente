using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Purchases;

/// <summary>
/// Régimen tributario ecuatoriano del proveedor (determinante para reglas de retención SRI).
/// </summary>
public enum SupplierTaxRegime
{
    General = 1,
    RimpeEmprendedor = 2,
    RimpeNegocioPopular = 3,
    ContribuyenteEspecial = 4,
    EntidadPublica = 5
}

/// <summary>
/// Tipo de identificación tributaria legal del proveedor.
/// </summary>
public enum SupplierIdentificationType
{
    Ruc = 1,
    Cedula = 2,
    Pasaporte = 3
}

/// <summary>
/// Proveedor comercial o de servicios de la empresa (Tenant) en Ecuador.
/// </summary>
public sealed class Supplier : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 300;
    public const int TradeNameMaxLength = 300;
    public const int TaxIdMaxLength = 20;
    public const int EmailMaxLength = 254;
    public const int PhoneMaxLength = 50;
    public const int AddressMaxLength = 500;
    public const int BankMaxLength = 100;
    public const int BankAccountMaxLength = 50;

    private readonly List<PurchaseProforma> _proformas = [];

    private Supplier()
    {
    }

    public Guid TenantId { get; private set; }

    /// <summary>Razón Social legal registrada en el SRI.</summary>
    public string BusinessName { get; private set; } = string.Empty;

    /// <summary>Nombre Comercial o de marca del proveedor.</summary>
    public string? TradeName { get; private set; }

    /// <summary>Tipo de documento de identificación (RUC, Cédula, Pasaporte).</summary>
    public SupplierIdentificationType IdentificationType { get; private set; } = SupplierIdentificationType.Ruc;

    /// <summary>Número de RUC, Cédula o Pasaporte.</summary>
    public string TaxId { get; private set; } = string.Empty;

    /// <summary>Régimen tributario fiscal SRI.</summary>
    public SupplierTaxRegime TaxRegime { get; private set; } = SupplierTaxRegime.General;

    /// <summary>Indica si el proveedor es calificado por el SRI como Agente de Retención.</summary>
    public bool IsRetentionAgent { get; private set; }

    /// <summary>Número de resolución SRI si es Agente de Retención o Contribuyente Especial.</summary>
    public string? ResolutionNumber { get; private set; }

    /// <summary>Correo principal donde se envían las retenciones electrónicas y órdenes.</summary>
    public string? ContactEmail { get; private set; }

    /// <summary>Teléfono de contacto o WhatsApp comercial.</summary>
    public string? ContactPhone { get; private set; }

    /// <summary>Dirección matriz o sucursal principal.</summary>
    public string? Address { get; private set; }

    /// <summary>Nombre de la persona o ejecutivo de contacto.</summary>
    public string? ContactPerson { get; private set; }

    /// <summary>Días de crédito otorgados (0 = Contado, 15, 30, 60, etc.).</summary>
    public int CreditDays { get; private set; }

    /// <summary>Cupo o límite de crédito concedido por el proveedor en USD.</summary>
    public decimal? CreditLimit { get; private set; }

    /// <summary>Banco para pagos y transferencias.</summary>
    public string? BankName { get; private set; }

    /// <summary>Tipo de cuenta bancaria (Ahorros, Corriente).</summary>
    public string? BankAccountType { get; private set; }

    /// <summary>Número de cuenta bancaria.</summary>
    public string? BankAccountNumber { get; private set; }

    /// <summary>Notas internas u observaciones sobre el proveedor.</summary>
    public string? Notes { get; private set; }

    public bool IsActive { get; private set; } = true;

    public IReadOnlyCollection<PurchaseProforma> Proformas => _proformas.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }

    public static Result<Supplier> Create(
        Guid id,
        Guid tenantId,
        string businessName,
        string taxId,
        SupplierIdentificationType identificationType = SupplierIdentificationType.Ruc,
        SupplierTaxRegime taxRegime = SupplierTaxRegime.General,
        string? tradeName = null,
        bool isRetentionAgent = false,
        string? resolutionNumber = null,
        string? contactEmail = null,
        string? contactPhone = null,
        string? address = null,
        string? contactPerson = null,
        int creditDays = 0,
        decimal? creditLimit = null,
        string? bankName = null,
        string? bankAccountType = null,
        string? bankAccountNumber = null,
        string? notes = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<Supplier>(new Error("supplier.id.empty", "El Id del proveedor es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Supplier>(new Error("supplier.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(businessName))
        {
            return Result.Failure<Supplier>(new Error("supplier.business_name.empty", "La razón social del proveedor es obligatoria.", ErrorType.Validation));
        }

        var trimmedBusinessName = businessName.Trim();
        if (trimmedBusinessName.Length > NameMaxLength)
        {
            return Result.Failure<Supplier>(new Error("supplier.business_name.toolong", $"La razón social no puede superar los {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(taxId))
        {
            return Result.Failure<Supplier>(new Error("supplier.tax_id.empty", "La identificación tributaria (RUC/Cédula) es obligatoria.", ErrorType.Validation));
        }

        var taxValidation = ValidateTaxId(taxId, identificationType);
        if (taxValidation.IsFailure)
        {
            return Result.Failure<Supplier>(taxValidation.Error!);
        }

        if (creditDays < 0)
        {
            return Result.Failure<Supplier>(new Error("supplier.credit_days.invalid", "Los días de crédito no pueden ser negativos.", ErrorType.Validation));
        }

        if (creditLimit.HasValue && creditLimit.Value < 0)
        {
            return Result.Failure<Supplier>(new Error("supplier.credit_limit.invalid", "El límite de crédito no puede ser negativo.", ErrorType.Validation));
        }

        string? cleanEmail = null;
        if (!string.IsNullOrWhiteSpace(contactEmail))
        {
            var trimmedEmail = contactEmail.Trim().ToLowerInvariant();
            if (trimmedEmail.Length > EmailMaxLength || !IsValidEmail(trimmedEmail))
            {
                return Result.Failure<Supplier>(new Error("supplier.contact_email.invalid", "El correo electrónico del proveedor no tiene un formato válido.", ErrorType.Validation));
            }

            cleanEmail = trimmedEmail;
        }

        return new Supplier
        {
            Id = id,
            TenantId = tenantId,
            BusinessName = trimmedBusinessName,
            TradeName = string.IsNullOrWhiteSpace(tradeName) ? null : tradeName.Trim(),
            TaxId = taxId.Trim(),
            IdentificationType = identificationType,
            TaxRegime = taxRegime,
            IsRetentionAgent = isRetentionAgent,
            ResolutionNumber = string.IsNullOrWhiteSpace(resolutionNumber) ? null : resolutionNumber.Trim(),
            ContactEmail = cleanEmail,
            ContactPhone = string.IsNullOrWhiteSpace(contactPhone) ? null : contactPhone.Trim(),
            Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim(),
            ContactPerson = string.IsNullOrWhiteSpace(contactPerson) ? null : contactPerson.Trim(),
            CreditDays = creditDays,
            CreditLimit = creditLimit,
            BankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName.Trim(),
            BankAccountType = string.IsNullOrWhiteSpace(bankAccountType) ? null : bankAccountType.Trim(),
            BankAccountNumber = string.IsNullOrWhiteSpace(bankAccountNumber) ? null : bankAccountNumber.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        };
    }

    public Result Update(
        string businessName,
        string taxId,
        SupplierIdentificationType identificationType,
        SupplierTaxRegime taxRegime,
        string? tradeName = null,
        bool isRetentionAgent = false,
        string? resolutionNumber = null,
        string? contactEmail = null,
        string? contactPhone = null,
        string? address = null,
        string? contactPerson = null,
        int creditDays = 0,
        decimal? creditLimit = null,
        string? bankName = null,
        string? bankAccountType = null,
        string? bankAccountNumber = null,
        string? notes = null,
        Guid? updatedBy = null)
    {
        if (string.IsNullOrWhiteSpace(businessName))
        {
            return Result.Failure(new Error("supplier.business_name.empty", "La razón social del proveedor es obligatoria.", ErrorType.Validation));
        }

        var trimmedBusinessName = businessName.Trim();
        if (trimmedBusinessName.Length > NameMaxLength)
        {
            return Result.Failure(new Error("supplier.business_name.toolong", $"La razón social no puede superar los {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        var taxValidation = ValidateTaxId(taxId, identificationType);
        if (taxValidation.IsFailure)
        {
            return Result.Failure(taxValidation.Error!);
        }

        if (creditDays < 0)
        {
            return Result.Failure(new Error("supplier.credit_days.invalid", "Los días de crédito no pueden ser negativos.", ErrorType.Validation));
        }

        if (creditLimit.HasValue && creditLimit.Value < 0)
        {
            return Result.Failure(new Error("supplier.credit_limit.invalid", "El límite de crédito no puede ser negativo.", ErrorType.Validation));
        }

        string? cleanEmail = null;
        if (!string.IsNullOrWhiteSpace(contactEmail))
        {
            var trimmedEmail = contactEmail.Trim().ToLowerInvariant();
            if (trimmedEmail.Length > EmailMaxLength || !IsValidEmail(trimmedEmail))
            {
                return Result.Failure(new Error("supplier.contact_email.invalid", "El correo electrónico del proveedor no tiene un formato válido.", ErrorType.Validation));
            }

            cleanEmail = trimmedEmail;
        }

        BusinessName = trimmedBusinessName;
        TradeName = string.IsNullOrWhiteSpace(tradeName) ? null : tradeName.Trim();
        TaxId = taxId.Trim();
        IdentificationType = identificationType;
        TaxRegime = taxRegime;
        IsRetentionAgent = isRetentionAgent;
        ResolutionNumber = string.IsNullOrWhiteSpace(resolutionNumber) ? null : resolutionNumber.Trim();
        ContactEmail = cleanEmail;
        ContactPhone = string.IsNullOrWhiteSpace(contactPhone) ? null : contactPhone.Trim();
        Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim();
        ContactPerson = string.IsNullOrWhiteSpace(contactPerson) ? null : contactPerson.Trim();
        CreditDays = creditDays;
        CreditLimit = creditLimit;
        BankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName.Trim();
        BankAccountType = string.IsNullOrWhiteSpace(bankAccountType) ? null : bankAccountType.Trim();
        BankAccountNumber = string.IsNullOrWhiteSpace(bankAccountNumber) ? null : bankAccountNumber.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
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
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
        return Result.Success();
    }

    public Result SoftDelete(Guid? deletedBy = null)
    {
        IsActive = false;
        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = deletedBy;
        return Result.Success();
    }

    public Result AddProforma(PurchaseProforma proforma)
    {
        if (proforma is null)
        {
            return Result.Failure(new Error("supplier.proforma.null", "La proforma es obligatoria.", ErrorType.Validation));
        }

        if (proforma.SupplierId != Id)
        {
            return Result.Failure(new Error("supplier.proforma.mismatch", "La proforma no pertenece a este proveedor.", ErrorType.Validation));
        }

        _proformas.Add(proforma);
        return Result.Success();
    }

    private static Result ValidateTaxId(string taxId, SupplierIdentificationType identificationType)
    {
        var clean = taxId.Trim();
        if (clean.Length > TaxIdMaxLength)
        {
            return Result.Failure(new Error("supplier.tax_id.toolong", $"La identificación no puede superar los {TaxIdMaxLength} caracteres.", ErrorType.Validation));
        }

        if (identificationType == SupplierIdentificationType.Cedula)
        {
            if (clean.Length != 10 || !clean.All(char.IsAsciiDigit))
            {
                return Result.Failure(new Error("supplier.tax_id.cedula.format", "La cédula debe contener exactamente 10 dígitos numéricos.", ErrorType.Validation));
            }

            if (!ValidateCedulaModulo10(clean))
            {
                return Result.Failure(new Error("supplier.tax_id.cedula.invalid", "El número de cédula no supera la validación del algoritmo Módulo 10 del SRI.", ErrorType.Validation));
            }
        }
        else if (identificationType == SupplierIdentificationType.Ruc)
        {
            if (clean.Length != 13 || !clean.All(char.IsAsciiDigit))
            {
                return Result.Failure(new Error("supplier.tax_id.ruc.format", "El RUC debe contener exactamente 13 dígitos numéricos.", ErrorType.Validation));
            }

            if (!ValidateRucEcuador(clean))
            {
                return Result.Failure(new Error("supplier.tax_id.ruc.invalid", "El RUC no supera la validación tributaria del SRI.", ErrorType.Validation));
            }
        }
        else if (identificationType == SupplierIdentificationType.Pasaporte)
        {
            if (clean.Length < 3)
            {
                return Result.Failure(new Error("supplier.tax_id.passport.tooshort", "El pasaporte debe contener al menos 3 caracteres.", ErrorType.Validation));
            }
        }

        return Result.Success();
    }

    public static bool ValidateCedulaModulo10(string cedula)
    {
        if (cedula.Length != 10 || !cedula.All(char.IsAsciiDigit))
        {
            return false;
        }

        var province = int.Parse(cedula[..2], System.Globalization.CultureInfo.InvariantCulture);
        if ((province < 1 || province > 24) && province != 30)
        {
            return false;
        }

        var thirdDigit = int.Parse(cedula[2].ToString(), System.Globalization.CultureInfo.InvariantCulture);
        if (thirdDigit >= 6)
        {
            return false;
        }

        int[] coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        var sum = 0;
        for (var i = 0; i < 9; i++)
        {
            var val = int.Parse(cedula[i].ToString(), System.Globalization.CultureInfo.InvariantCulture) * coefficients[i];
            if (val >= 10)
            {
                val -= 9;
            }
            sum += val;
        }

        var remainder = sum % 10;
        var checkDigit = remainder == 0 ? 0 : 10 - remainder;
        return checkDigit == int.Parse(cedula[9].ToString(), System.Globalization.CultureInfo.InvariantCulture);
    }

    public static bool ValidateRucEcuador(string ruc)
    {
        if (ruc.Length != 13 || !ruc.All(char.IsAsciiDigit))
        {
            return false;
        }

        var province = int.Parse(ruc[..2], System.Globalization.CultureInfo.InvariantCulture);
        if ((province < 1 || province > 24) && province != 30)
        {
            return false;
        }

        var thirdDigit = int.Parse(ruc[2].ToString(), System.Globalization.CultureInfo.InvariantCulture);

        // RUC Persona Natural (tercer dígito 0-5)
        if (thirdDigit < 6)
        {
            var cedula = ruc[..10];
            if (!ValidateCedulaModulo10(cedula))
            {
                return false;
            }
            var establishment = ruc[10..13];
            return establishment != "000";
        }

        // RUC Sociedad Pública (tercer dígito 6)
        if (thirdDigit == 6)
        {
            if (ruc[9..13] == "0000")
            {
                return false;
            }
            int[] coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
            var sum = 0;
            for (var i = 0; i < 8; i++)
            {
                sum += int.Parse(ruc[i].ToString(), System.Globalization.CultureInfo.InvariantCulture) * coefficients[i];
            }
            var remainder = sum % 11;
            var checkDigit = remainder == 0 ? 0 : 11 - remainder;
            if (checkDigit == 10)
            {
                return false;
            }
            return checkDigit == int.Parse(ruc[8].ToString(), System.Globalization.CultureInfo.InvariantCulture);
        }

        // RUC Sociedad Privada o Extranjeros (tercer dígito 9)
        if (thirdDigit == 9)
        {
            if (ruc[10..13] == "000")
            {
                return false;
            }
            int[] coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
            var sum = 0;
            for (var i = 0; i < 9; i++)
            {
                sum += int.Parse(ruc[i].ToString(), System.Globalization.CultureInfo.InvariantCulture) * coefficients[i];
            }
            var remainder = sum % 11;
            var checkDigit = remainder == 0 ? 0 : 11 - remainder;
            if (checkDigit == 10)
            {
                return false;
            }
            return checkDigit == int.Parse(ruc[9].ToString(), System.Globalization.CultureInfo.InvariantCulture);
        }

        return false;
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        try
        {
            var addr = new System.Net.Mail.MailAddress(email.Trim());
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }
}
