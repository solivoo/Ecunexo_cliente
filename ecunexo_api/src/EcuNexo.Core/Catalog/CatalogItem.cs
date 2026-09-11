using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Catalog.ValueObjects;
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

    private readonly List<CatalogItemImage> _images = [];

    private CatalogItem()
    {
        Name = string.Empty;
        CustomAttributesJson = CatalogAttributeSchema.EmptyObjectJson;
    }

    public IReadOnlyCollection<CatalogItemImage> Images => _images.AsReadOnly();

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

    /// <summary>Baja lógica: deja de listarse. Requiere que el caller valide usos asociados.</summary>
    public Result SoftDelete(DateTimeOffset utcNow, Guid? deletedBy = null)
    {
        if (DeletedAt is not null)
        {
            return Result.Success();
        }

        DeletedAt = utcNow;
        DeletedBy = deletedBy;
        Status = CatalogItemStatus.Inactive;
        Touch(deletedBy);
        return Result.Success();
    }

    public Result<CatalogItemImage> AddImage(
        Guid imageId,
        string storageKey,
        string originalFileName,
        string? altText,
        ImageDimensions dimensions,
        long fileSizeBytes,
        string thumbUrl,
        string mediumUrl,
        string largeUrl,
        bool? setAsMain = null,
        Guid? createdBy = null)
    {
        if (_images.Count >= ImageOptimizationPolicy.MaxImagesPerItem)
        {
            return Result.Failure<CatalogItemImage>(new Error(
                "catalog.item.image.limit.exceeded",
                $"No se pueden agregar más de {ImageOptimizationPolicy.MaxImagesPerItem} imágenes por producto.",
                ErrorType.Validation));
        }

        var isMain = setAsMain ?? (_images.Count == 0);

        if (isMain)
        {
            foreach (var img in _images)
            {
                img.DemoteFromMain();
            }
        }

        var nextOrder = _images.Count + 1;

        var imageResult = CatalogItemImage.Create(
            imageId,
            Id,
            storageKey,
            originalFileName,
            altText,
            nextOrder,
            isMain,
            dimensions,
            fileSizeBytes,
            thumbUrl,
            mediumUrl,
            largeUrl,
            createdBy);

        if (imageResult.IsFailure)
        {
            return Result.Failure<CatalogItemImage>(imageResult.Error!);
        }

        _images.Add(imageResult.Value!);
        Touch(createdBy);
        return Result.Success(imageResult.Value!);
    }

    public Result RemoveImage(Guid imageId, Guid? updatedBy = null)
    {
        var image = _images.FirstOrDefault(i => i.Id == imageId);
        if (image is null)
        {
            return Result.Failure(new Error(
                "catalog.item.image.not_found",
                "La imagen indicada no existe en este producto.",
                ErrorType.NotFound));
        }

        var wasMain = image.IsMain;
        _images.Remove(image);

        if (wasMain && _images.Count > 0)
        {
            _images.OrderBy(i => i.DisplayOrder).First().PromoteToMain();
        }

        var order = 1;
        foreach (var img in _images.OrderBy(i => i.DisplayOrder))
        {
            img.SetOrder(order++);
        }

        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetMainImage(Guid imageId, Guid? updatedBy = null)
    {
        var targetImage = _images.FirstOrDefault(i => i.Id == imageId);
        if (targetImage is null)
        {
            return Result.Failure(new Error(
                "catalog.item.image.not_found",
                "La imagen indicada no pertenece a este producto.",
                ErrorType.NotFound));
        }

        if (targetImage.IsMain)
        {
            return Result.Success();
        }

        foreach (var img in _images)
        {
            if (img.Id == imageId)
            {
                img.PromoteToMain();
            }
            else if (img.IsMain)
            {
                img.DemoteFromMain();
            }
        }

        Touch(updatedBy);
        return Result.Success();
    }

    public Result ReorderImages(IReadOnlyList<Guid> orderedImageIds, Guid? updatedBy = null)
    {
        if (orderedImageIds.Count != _images.Count || orderedImageIds.Distinct().Count() != _images.Count)
        {
            return Result.Failure(new Error(
                "catalog.item.image.reorder.invalid",
                "La lista de identificadores no coincide con la cantidad actual de imágenes.",
                ErrorType.Validation));
        }

        var imageMap = _images.ToDictionary(i => i.Id);
        foreach (var id in orderedImageIds)
        {
            if (!imageMap.ContainsKey(id))
            {
                return Result.Failure(new Error(
                    "catalog.item.image.reorder.unknown_id",
                    $"El identificador {id} no pertenece a las imágenes de este producto.",
                    ErrorType.Validation));
            }
        }

        for (var i = 0; i < orderedImageIds.Count; i++)
        {
            imageMap[orderedImageIds[i]].SetOrder(i + 1);
        }

        Touch(updatedBy);
        return Result.Success();
    }

    public Result UpdateImageAltText(Guid imageId, string? altText, Guid? updatedBy = null)
    {
        var image = _images.FirstOrDefault(i => i.Id == imageId);
        if (image is null)
        {
            return Result.Failure(new Error(
                "catalog.item.image.not_found",
                "La imagen indicada no existe en este producto.",
                ErrorType.NotFound));
        }

        var result = image.UpdateAltText(altText, updatedBy);
        if (result.IsFailure)
        {
            return result;
        }

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
