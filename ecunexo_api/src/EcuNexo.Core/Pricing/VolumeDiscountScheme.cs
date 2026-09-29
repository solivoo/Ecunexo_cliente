using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Pricing;

/// <summary>
/// Esquema reutilizable de descuentos o precios por volumen de compra.
/// Permite definir reglas de escala (ej. 6+ unidades = 15% OFF, 12+ unidades = 25% OFF)
/// y asignarlas de forma masiva o individual a los productos.
/// </summary>
public sealed class VolumeDiscountScheme : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 300;

    private readonly List<VolumeDiscountTier> _tiers = [];

    private VolumeDiscountScheme()
    {
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public VolumeDiscountSchemeType Type { get; private set; }

    public bool IsActive { get; private set; }

    public IReadOnlyList<VolumeDiscountTier> Tiers => _tiers.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<VolumeDiscountScheme> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? description,
        VolumeDiscountSchemeType type,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty || tenantId == Guid.Empty)
        {
            return Result.Failure<VolumeDiscountScheme>(
                new Error("catalog.pricing.volume_scheme.keys.invalid", "El identificador y la empresa son obligatorios.", ErrorType.Validation));
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<VolumeDiscountScheme>(nameResult.Error!);
        }

        var descResult = NormalizeDescription(description);
        if (descResult.IsFailure)
        {
            return Result.Failure<VolumeDiscountScheme>(descResult.Error!);
        }

        return new VolumeDiscountScheme
        {
            Id = id,
            TenantId = tenantId,
            Name = nameResult.Value!,
            Description = descResult.Value,
            Type = type,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        string name,
        string? description,
        VolumeDiscountSchemeType type,
        Guid? updatedBy = null)
    {
        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure(nameResult.Error!);
        }

        var descResult = NormalizeDescription(description);
        if (descResult.IsFailure)
        {
            return Result.Failure(descResult.Error!);
        }

        foreach (var tier in _tiers)
        {
            var tierValidation = VolumeDiscountTier.Validate(tier.QuantityFrom, tier.QuantityTo, tier.Value, type);
            if (tierValidation.IsFailure)
            {
                return tierValidation;
            }
        }

        Name = nameResult.Value!;
        Description = descResult.Value;
        Type = type;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result<VolumeDiscountTier> AddTier(
        Guid tierId,
        decimal quantityFrom,
        decimal? quantityTo,
        decimal value,
        Guid? createdBy = null)
    {
        var validation = VolumeDiscountTier.Validate(quantityFrom, quantityTo, value, Type);
        if (validation.IsFailure)
        {
            return Result.Failure<VolumeDiscountTier>(validation.Error!);
        }

        var overlaps = _tiers.Any(t => t.IsActive && t.Overlaps(quantityFrom, quantityTo));
        if (overlaps)
        {
            return Result.Failure<VolumeDiscountTier>(
                new Error("catalog.pricing.volume_scheme.tier.overlap", "El escalón se superpone con otro escalón activo en este esquema.", ErrorType.Conflict));
        }

        var tierResult = VolumeDiscountTier.Create(tierId, Id, quantityFrom, quantityTo, value, Type, createdBy);
        if (tierResult.IsFailure)
        {
            return Result.Failure<VolumeDiscountTier>(tierResult.Error!);
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
                new Error("catalog.pricing.volume_scheme.tier.not_found", "El escalón indicado no existe.", ErrorType.NotFound));
        }

        return tier.SetActive(false, updatedBy);
    }

    public Result ClearTiers(Guid? updatedBy = null)
    {
        _tiers.Clear();
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetActive(bool isActive, Guid? updatedBy = null)
    {
        IsActive = isActive;
        Touch(updatedBy);
        return Result.Success();
    }

    private static Result<string> NormalizeName(string name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.volume_scheme.name.required", "El nombre del esquema es obligatorio.", ErrorType.Validation));
        }

        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.pricing.volume_scheme.name.length", $"El nombre no puede exceder {NameMaxLength} caracteres.", ErrorType.Validation));
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
                new Error("catalog.pricing.volume_scheme.description.length", $"La descripción no puede exceder {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }
}
