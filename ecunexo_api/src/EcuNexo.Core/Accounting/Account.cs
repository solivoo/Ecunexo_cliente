using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Accounting;

/// <summary>
/// Clasificación de cuentas contables según las NIIF y la Superintendencia de Compañías del Ecuador.
/// </summary>
public enum AccountType
{
    Asset = 1,      // 1. Activo
    Liability = 2,  // 2. Pasivo
    Equity = 3,     // 3. Patrimonio
    Revenue = 4,    // 4. Ingresos
    Expense = 5     // 5. Costos y Gastos
}

/// <summary>
/// Naturaleza contable de la cuenta.
/// </summary>
public enum AccountNature
{
    Debit = 1,  // Deudora (aumenta al Debe, disminuye al Haber)
    Credit = 2  // Acreedora (aumenta al Haber, disminuye al Debe)
}

/// <summary>
/// Representa una cuenta contable dentro del Plan General de Cuentas del tenant (NIIF / SCVS Ecuador).
/// </summary>
public sealed class Account : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int CodeMaxLength = 50;
    public const int NameMaxLength = 200;
    public const int DescriptionMaxLength = 500;

    private Account()
    {
    }

    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public AccountType AccountType { get; private set; }
    public AccountNature Nature { get; private set; }
    public int Level { get; private set; }
    public Guid? ParentAccountId { get; private set; }
    public string? ParentCode { get; private set; }
    public bool AllowsMovement { get; private set; }
    public bool IsSystem { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? Description { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public Guid? CreatedBy { get; private set; }
    public Guid? UpdatedBy { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public Guid? DeletedBy { get; private set; }

    public static Result<Account> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        AccountType? accountType = null,
        AccountNature? nature = null,
        Guid? parentAccountId = null,
        string? parentCode = null,
        bool allowsMovement = true,
        bool isSystem = false,
        string? description = null,
        Guid? createdBy = null,
        DateTimeOffset? createdAt = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<Account>(
                new Error("accounting.account.id_empty", "El identificador de la cuenta no puede estar vacío.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Account>(
                new Error("accounting.account.tenant_empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure<Account>(
                new Error("accounting.account.code_empty", "El código contable es obligatorio.", ErrorType.Validation));
        }

        var normalizedCode = code.Trim().Replace(" ", string.Empty);
        if (normalizedCode.Length > CodeMaxLength)
        {
            return Result.Failure<Account>(
                new Error("accounting.account.code_length", $"El código no puede exceder {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Account>(
                new Error("accounting.account.name_empty", "El nombre de la cuenta contable es obligatorio.", ErrorType.Validation));
        }

        if (name.Trim().Length > NameMaxLength)
        {
            return Result.Failure<Account>(
                new Error("accounting.account.name_length", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        // Determinar nivel jerárquico por cantidad de segmentos separados por punto (ej. 1 -> nivel 1; 1.1 -> nivel 2; 1.1.01.01 -> nivel 4)
        var level = normalizedCode.Split('.', StringSplitOptions.RemoveEmptyEntries).Length;

        // Determinar tipo de cuenta por primer dígito si no fue provisto
        var rootDigit = normalizedCode[0];
        var resolvedType = accountType ?? rootDigit switch
        {
            '1' => AccountType.Asset,
            '2' => AccountType.Liability,
            '3' => AccountType.Equity,
            '4' => AccountType.Revenue,
            '5' => AccountType.Expense,
            _ => AccountType.Asset
        };

        // Determinar naturaleza contable si no fue provista (Activo y Gastos son deudoras; Pasivo, Patrimonio e Ingresos acreedoras)
        var resolvedNature = nature ?? (resolvedType is AccountType.Asset or AccountType.Expense
            ? AccountNature.Debit
            : AccountNature.Credit);

        // Inferir parent code si tiene puntos
        string? inferredParentCode = parentCode;
        if (string.IsNullOrWhiteSpace(inferredParentCode) && normalizedCode.Contains('.'))
        {
            var lastDot = normalizedCode.LastIndexOf('.');
            inferredParentCode = normalizedCode[..lastDot];
        }

        var account = new Account
        {
            Id = id,
            TenantId = tenantId,
            Code = normalizedCode,
            Name = name.Trim(),
            AccountType = resolvedType,
            Nature = resolvedNature,
            Level = level,
            ParentAccountId = parentAccountId,
            ParentCode = inferredParentCode,
            AllowsMovement = allowsMovement,
            IsSystem = isSystem,
            IsActive = true,
            Description = description?.Trim(),
            CreatedBy = createdBy,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow,
        };

        return Result.Success(account);
    }

    public Result<Account> Update(
        string name,
        string? description,
        bool allowsMovement,
        bool isActive,
        AccountNature? nature = null,
        Guid? updatedBy = null,
        DateTimeOffset? updatedAt = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Account>(
                new Error("accounting.account.name_empty", "El nombre de la cuenta no puede estar vacío.", ErrorType.Validation));
        }

        if (name.Trim().Length > NameMaxLength)
        {
            return Result.Failure<Account>(
                new Error("accounting.account.name_length", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        Name = name.Trim();
        Description = description?.Trim();
        AllowsMovement = allowsMovement;
        IsActive = isActive;
        if (nature.HasValue)
        {
            Nature = nature.Value;
        }

        UpdatedBy = updatedBy;
        UpdatedAt = updatedAt ?? DateTimeOffset.UtcNow;
        return Result.Success(this);
    }

    public void LinkParent(Guid parentAccountId, string parentCode)
    {
        ParentAccountId = parentAccountId;
        ParentCode = parentCode;
    }

    public Result MarkAsDeleted(Guid? deletedBy = null, DateTimeOffset? deletedAt = null)
    {
        if (IsSystem)
        {
            return Result.Failure(
                new Error("accounting.account.system_cannot_delete", "No se puede eliminar una cuenta estándar del sistema.", ErrorType.Conflict));
        }

        DeletedBy = deletedBy;
        DeletedAt = deletedAt ?? DateTimeOffset.UtcNow;
        IsActive = false;
        return Result.Success();
    }
}
