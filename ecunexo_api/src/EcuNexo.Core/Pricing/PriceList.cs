using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Lista de precios comercial (pública, mayorista, distribuidor, etc.). Solo una lista
/// predeterminada activa por empresa; las vigencias determinan su aplicabilidad por fecha.
/// </summary>
public sealed class PriceList : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int CodeMaxLength = 40;
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 300;
    public const int CurrencyMaxLength = 3;
    public const string DefaultCurrency = "USD";

    private PriceList()
    {
        Code = string.Empty;
        Name = string.Empty;
        Currency = DefaultCurrency;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Code { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public string Currency { get; private set; }

    /// <summary>True cuando los precios cargados ya incluyen impuesto (precio de góndola).</summary>
    public bool PricesIncludeTax { get; private set; }

    public DateOnly ValidFrom { get; private set; }

    public DateOnly? ValidTo { get; private set; }

    /// <summary>Desempate entre listas candidatas; mayor valor gana.</summary>
    public int Priority { get; private set; }

    public bool IsDefault { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<PriceList> Create(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description,
        string? currency,
        bool pricesIncludeTax,
        DateOnly validFrom,
        DateOnly? validTo,
        int priority,
        bool isDefault,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<PriceList>(
                new Error("catalog.pricing.price_list.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var codeResult = NormalizeCode(code);
        if (codeResult.IsFailure)
        {
            return Result.Failure<PriceList>(codeResult.Error!);
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<PriceList>(nameResult.Error!);
        }

        var descriptionResult = NormalizeDescription(description);
        if (descriptionResult.IsFailure)
        {
            return Result.Failure<PriceList>(descriptionResult.Error!);
        }

        var currencyResult = NormalizeCurrency(currency);
        if (currencyResult.IsFailure)
        {
            return Result.Failure<PriceList>(currencyResult.Error!);
        }

        var rangeResult = ValidateRange(validFrom, validTo);
        if (rangeResult.IsFailure)
        {
            return Result.Failure<PriceList>(rangeResult.Error!);
        }

        return new PriceList
        {
            Id = id,
            TenantId = tenantId,
            Code = codeResult.Value!,
            Name = nameResult.Value!,
            Description = descriptionResult.Value,
            Currency = currencyResult.Value!,
            PricesIncludeTax = pricesIncludeTax,
            ValidFrom = validFrom,
            ValidTo = validTo,
            Priority = priority,
            IsDefault = isDefault,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        string name,
        string? description,
        string? currency,
        bool pricesIncludeTax,
        DateOnly validFrom,
        DateOnly? validTo,
        int priority,
        Guid? updatedBy = null)
    {
        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure(nameResult.Error!);
        }

        var descriptionResult = NormalizeDescription(description);
        if (descriptionResult.IsFailure)
        {
            return Result.Failure(descriptionResult.Error!);
        }

        var currencyResult = NormalizeCurrency(currency);
        if (currencyResult.IsFailure)
        {
            return Result.Failure(currencyResult.Error!);
        }

        var rangeResult = ValidateRange(validFrom, validTo);
        if (rangeResult.IsFailure)
        {
            return Result.Failure(rangeResult.Error!);
        }

        Name = nameResult.Value!;
        Description = descriptionResult.Value;
        Currency = currencyResult.Value!;
        PricesIncludeTax = pricesIncludeTax;
        ValidFrom = validFrom;
        ValidTo = validTo;
        Priority = priority;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetDefault(bool isDefault, Guid? updatedBy = null)
    {
        if (isDefault && !IsActive)
        {
            return Result.Failure(
                new Error("catalog.pricing.price_list.default.inactive", "La lista predeterminada debe estar activa.", ErrorType.Validation));
        }

        IsDefault = isDefault;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        if (!isActive && IsDefault)
        {
            return Result.Failure(
                new Error("catalog.pricing.price_list.default.required", "La lista predeterminada no puede desactivarse sin asignar otra.", ErrorType.Validation));
        }

        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>True cuando la lista puede usarse para resolver precios en la fecha indicada.</summary>
    public bool IsValidOn(DateOnly date) =>
        IsActive && ValidFrom <= date && (ValidTo is null || ValidTo >= date);

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result<string> NormalizeCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.price_list.code.required", "El código de la lista es obligatorio.", ErrorType.Validation));
        }

        var normalized = code.Trim().ToUpperInvariant();
        if (normalized.Length > CodeMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.price_list.code.length", $"El código no puede superar {CodeMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(normalized);
    }

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.price_list.name.required", "El nombre de la lista es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.price_list.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string?> NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return Result.Success<string?>(null);
        }

        var trimmed = description.Trim();
        if (trimmed.Length > DescriptionMaxLength)
        {
            return Result.Failure<string?>(
                new Error("catalog.pricing.price_list.description.length", $"La descripción no puede superar {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }

    private static Result<string> NormalizeCurrency(string? currency)
    {
        if (string.IsNullOrWhiteSpace(currency))
        {
            return Result.Success(DefaultCurrency);
        }

        var normalized = currency.Trim().ToUpperInvariant();
        if (normalized.Length != CurrencyMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.price_list.currency.invalid", "La moneda debe tener 3 caracteres (ej. USD).", ErrorType.Validation));
        }

        return Result.Success(normalized);
    }

    private static Result ValidateRange(DateOnly validFrom, DateOnly? validTo)
    {
        if (validTo.HasValue && validTo.Value < validFrom)
        {
            return Result.Failure(
                new Error("catalog.pricing.price_list.range", "La fecha final no puede ser anterior a la inicial.", ErrorType.Validation));
        }

        return Result.Success();
    }
}
