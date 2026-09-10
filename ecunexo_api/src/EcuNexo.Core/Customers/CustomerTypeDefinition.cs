using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Customers;

/// <summary>
/// Tipo/clasificación comercial de cliente, configurable por tenant.
/// Los códigos 1–6 son del sistema (semilla); los personalizados empiezan en 100.
/// </summary>
public sealed class CustomerTypeDefinition : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 80;
    public const int ShortLabelMaxLength = 40;
    public const int ToneMaxLength = 20;
    public const int CustomCodeStart = 100;

    private CustomerTypeDefinition()
    {
    }

    public Guid TenantId { get; private set; }

    /// <summary>Código numérico almacenado en <c>Customer.CustomerType</c>.</summary>
    public int Code { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string ShortLabel { get; private set; } = string.Empty;

    /// <summary>Tone del badge UI: primary, success, warning, neutral.</summary>
    public string Tone { get; private set; } = "primary";

    public int SortOrder { get; private set; }

    public bool IsSystem { get; private set; }

    public bool IsActive { get; private set; } = true;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<CustomerTypeDefinition> CreateSystem(
        Guid id,
        Guid tenantId,
        int code,
        string name,
        string shortLabel,
        string tone,
        int sortOrder)
    {
        return CreateCore(id, tenantId, code, name, shortLabel, tone, sortOrder, isSystem: true);
    }

    public static Result<CustomerTypeDefinition> CreateCustom(
        Guid id,
        Guid tenantId,
        int code,
        string name,
        string shortLabel,
        string tone,
        int sortOrder)
    {
        if (code < CustomCodeStart)
        {
            return Result.Failure<CustomerTypeDefinition>(
                new Error(
                    "customer.type.code.reserved",
                    $"Los códigos personalizados deben ser ≥ {CustomCodeStart}.",
                    ErrorType.Validation));
        }

        return CreateCore(id, tenantId, code, name, shortLabel, tone, sortOrder, isSystem: false);
    }

    public Result Update(string name, string shortLabel, string tone, int sortOrder)
    {
        var nameResult = ValidateName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure(nameResult.Error!);
        }

        var shortResult = ValidateShortLabel(shortLabel);
        if (shortResult.IsFailure)
        {
            return Result.Failure(shortResult.Error!);
        }

        Name = nameResult.Value!;
        ShortLabel = shortResult.Value!;
        Tone = NormalizeTone(tone);
        SortOrder = sortOrder;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SoftDelete(Guid? deletedBy = null)
    {
        if (IsSystem)
        {
            return;
        }

        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = deletedBy;
        IsActive = false;
    }

    private static Result<CustomerTypeDefinition> CreateCore(
        Guid id,
        Guid tenantId,
        int code,
        string name,
        string shortLabel,
        string tone,
        int sortOrder,
        bool isSystem)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<CustomerTypeDefinition>(
                new Error("customer.type.id.empty", "El Id del tipo es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<CustomerTypeDefinition>(
                new Error("customer.type.tenant.empty", "El TenantId es obligatorio.", ErrorType.Validation));
        }

        if (code <= 0)
        {
            return Result.Failure<CustomerTypeDefinition>(
                new Error("customer.type.code.invalid", "El código del tipo debe ser positivo.", ErrorType.Validation));
        }

        var nameResult = ValidateName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<CustomerTypeDefinition>(nameResult.Error!);
        }

        var shortResult = ValidateShortLabel(shortLabel);
        if (shortResult.IsFailure)
        {
            return Result.Failure<CustomerTypeDefinition>(shortResult.Error!);
        }

        return new CustomerTypeDefinition
        {
            Id = id,
            TenantId = tenantId,
            Code = code,
            Name = nameResult.Value!,
            ShortLabel = shortResult.Value!,
            Tone = NormalizeTone(tone),
            SortOrder = sortOrder,
            IsSystem = isSystem,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    private static Result<string> ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("customer.type.name.empty", "El nombre del tipo es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "customer.type.name.toolong",
                    $"El nombre no puede exceder {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string> ValidateShortLabel(string shortLabel)
    {
        if (string.IsNullOrWhiteSpace(shortLabel))
        {
            return Result.Failure<string>(
                new Error(
                    "customer.type.short_label.empty",
                    "La etiqueta corta es obligatoria.",
                    ErrorType.Validation));
        }

        var trimmed = shortLabel.Trim();
        if (trimmed.Length > ShortLabelMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "customer.type.short_label.toolong",
                    $"La etiqueta corta no puede exceder {ShortLabelMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static string NormalizeTone(string? tone)
    {
        var t = (tone ?? "primary").Trim().ToLowerInvariant();
        return t is "primary" or "success" or "warning" or "neutral" ? t : "primary";
    }
}
