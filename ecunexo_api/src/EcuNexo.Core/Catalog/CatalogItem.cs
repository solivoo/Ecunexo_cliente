using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Maestro de qué se vende o se usa. Sin cantidades (ADR-009). MVP: 1 ítem físico = 1 SKU (ADR-010).
/// </summary>
public sealed class CatalogItem : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 200;
    public const int DescriptionMaxLength = 1000;

    private CatalogItem()
    {
        Name = string.Empty;
        CustomAttributesJson = CatalogAttributeSchema.EmptyObjectJson;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid? CategoryId { get; private set; }

    public Category? Category { get; private set; }

    public CatalogItemKind Kind { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public string? Sku { get; private set; }

    public decimal? BasePrice { get; private set; }

    public string CustomAttributesJson { get; private set; }

    public CatalogItemStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<CatalogItem> Create(
        Guid id,
        Guid tenantId,
        CatalogItemKind kind,
        string name,
        string? description,
        string? sku,
        decimal? basePrice,
        Guid? categoryId,
        string? customAttributesJson,
        string categorySchemaJson)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<CatalogItem>(
                new Error("catalog.item.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(kind))
        {
            return Result.Failure<CatalogItem>(
                new Error("catalog.item.kind.invalid", "El tipo de ítem no es válido.", ErrorType.Validation));
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(nameResult.Error!);
        }

        var descResult = NormalizeDescription(description);
        if (descResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(descResult.Error!);
        }

        var skuResult = NormalizeSku(kind, sku);
        if (skuResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(skuResult.Error!);
        }

        var priceResult = NormalizePrice(basePrice);
        if (priceResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(priceResult.Error!);
        }

        var attrs = CatalogAttributeSchema.NormalizeAttributes(customAttributesJson);
        if (attrs.IsFailure)
        {
            return Result.Failure<CatalogItem>(attrs.Error!);
        }

        var againstSchema = CatalogAttributeSchema.ValidateAgainstSchema(categorySchemaJson, attrs.Value!);
        if (againstSchema.IsFailure)
        {
            return Result.Failure<CatalogItem>(againstSchema.Error!);
        }

        return new CatalogItem
        {
            Id = id,
            TenantId = tenantId,
            CategoryId = categoryId,
            Kind = kind,
            Name = nameResult.Value!,
            Description = descResult.Value,
            Sku = skuResult.Value,
            BasePrice = priceResult.Value,
            CustomAttributesJson = attrs.Value!,
            Status = CatalogItemStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result Update(
        string name,
        string? description,
        string? sku,
        decimal? basePrice,
        Guid? categoryId,
        string? customAttributesJson,
        string categorySchemaJson,
        Guid? updatedBy)
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

        var skuResult = NormalizeSku(Kind, sku);
        if (skuResult.IsFailure)
        {
            return Result.Failure(skuResult.Error!);
        }

        var priceResult = NormalizePrice(basePrice);
        if (priceResult.IsFailure)
        {
            return Result.Failure(priceResult.Error!);
        }

        var attrs = CatalogAttributeSchema.NormalizeAttributes(customAttributesJson);
        if (attrs.IsFailure)
        {
            return Result.Failure(attrs.Error!);
        }

        var againstSchema = CatalogAttributeSchema.ValidateAgainstSchema(categorySchemaJson, attrs.Value!);
        if (againstSchema.IsFailure)
        {
            return Result.Failure(againstSchema.Error!);
        }

        Name = nameResult.Value!;
        Description = descResult.Value;
        Sku = skuResult.Value;
        BasePrice = priceResult.Value;
        CategoryId = categoryId;
        CustomAttributesJson = attrs.Value!;
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>
    /// Servicio → físico requiere SKU. Físico → servicio lo decide el handler si no hay kárdex.
    /// </summary>
    public Result ChangeKind(CatalogItemKind kind, string? sku, Guid? updatedBy)
    {
        if (!Enum.IsDefined(kind))
        {
            return Result.Failure(
                new Error("catalog.item.kind.invalid", "El tipo de ítem no es válido.", ErrorType.Validation));
        }

        if (kind == Kind)
        {
            return Result.Success();
        }

        var skuResult = NormalizeSku(kind, sku);
        if (skuResult.IsFailure)
        {
            return Result.Failure(skuResult.Error!);
        }

        Kind = kind;
        Sku = skuResult.Value;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetStatus(CatalogItemStatus status, Guid? updatedBy)
    {
        if (!Enum.IsDefined(status))
        {
            return Result.Failure(
                new Error("catalog.item.status.invalid", "El estado del ítem no es válido.", ErrorType.Validation));
        }

        Status = status;
        Touch(updatedBy);
        return Result.Success();
    }

    private void Touch(Guid? updatedBy)
    {
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("catalog.item.name.required", "El nombre del ítem es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "catalog.item.name.length",
                    $"El nombre no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success(trimmed);
    }

    private static Result<string?> NormalizeDescription(string? description)
    {
        if (description is null)
        {
            return Result.Success<string?>(null);
        }

        var trimmed = description.Trim();
        if (trimmed.Length > DescriptionMaxLength)
        {
            return Result.Failure<string?>(
                new Error(
                    "catalog.item.description.length",
                    $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed.Length == 0 ? null : trimmed);
    }

    private static Result<string?> NormalizeSku(CatalogItemKind kind, string? sku)
    {
        if (string.IsNullOrWhiteSpace(sku))
        {
            if (kind == CatalogItemKind.Physical)
            {
                return Result.Failure<string?>(
                    new Error(
                        "catalog.item.sku.required",
                        "El SKU es obligatorio para ítems físicos.",
                        ErrorType.Validation));
            }

            return Result.Success<string?>(null);
        }

        var created = global::EcuNexo.Core.Catalog.Sku.Create(sku);
        if (created.IsFailure)
        {
            return Result.Failure<string?>(created.Error!);
        }

        return Result.Success<string?>(created.Value!.Value);
    }

    private static Result<decimal?> NormalizePrice(decimal? basePrice)
    {
        if (basePrice is null)
        {
            return Result.Success<decimal?>(null);
        }

        if (basePrice.Value < 0)
        {
            return Result.Failure<decimal?>(
                new Error(
                    "catalog.item.price.range",
                    "El precio base no puede ser negativo.",
                    ErrorType.Validation));
        }

        return Result.Success<decimal?>(decimal.Round(basePrice.Value, 4, MidpointRounding.AwayFromZero));
    }
}
