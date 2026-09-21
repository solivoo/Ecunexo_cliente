using System.Text.Json;
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
    public const int HierarchyPathMaxEntries = 12;
    public const int HierarchyPathTextMaxLength = 120;

    private readonly List<CatalogItemImage> _images = [];
    private readonly List<CatalogItem> _variants = [];

    private CatalogItem()
    {
        Name = string.Empty;
        CustomAttributesJson = CatalogAttributeSchema.EmptyObjectJson;
    }

    public IReadOnlyCollection<CatalogItemImage> Images => _images.AsReadOnly();

    public IReadOnlyCollection<CatalogItem> Variants => _variants.AsReadOnly();

    public Guid? ParentId { get; private set; }

    public CatalogItem? Parent { get; private set; }

    public bool IsMatrixParent { get; private set; }

    public string? VariantDimensionsJson { get; private set; }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid? CategoryId { get; private set; }

    public Category? Category { get; private set; }

    /// <summary>Arquetipo/Familia (plantilla de producto) que describe la forma del ítem.</summary>
    public Guid? FamilyId { get; private set; }

    /// <summary>Ruta jerárquica capturada al crear: [{ level, name, value }]. Las variantes la heredan del padre.</summary>
    public string? HierarchyPathJson { get; private set; }

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
        string categorySchemaJson,
        Guid? familyId = null,
        string? hierarchyPathJson = null)
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

        var path = NormalizeHierarchyPath(hierarchyPathJson);
        if (path.IsFailure)
        {
            return Result.Failure<CatalogItem>(path.Error!);
        }

        return new CatalogItem
        {
            Id = id,
            TenantId = tenantId,
            CategoryId = categoryId,
            FamilyId = familyId,
            HierarchyPathJson = path.Value,
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

    public static Result<CatalogItem> CreateMatrixParent(
        Guid id,
        Guid tenantId,
        CatalogItemKind kind,
        string name,
        string? description,
        string? modelCode,
        decimal? basePrice,
        Guid? categoryId,
        string variantDimensionsJson,
        string? customAttributesJson,
        string categorySchemaJson,
        Guid? createdBy = null,
        Guid? familyId = null,
        string? hierarchyPathJson = null)
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

        var dimsResult = NormalizeVariantDimensions(variantDimensionsJson);
        if (dimsResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(dimsResult.Error!);
        }

        var skuResult = NormalizeSku(kind, modelCode, isMatrixParent: true);
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

        var path = NormalizeHierarchyPath(hierarchyPathJson);
        if (path.IsFailure)
        {
            return Result.Failure<CatalogItem>(path.Error!);
        }

        return new CatalogItem
        {
            Id = id,
            TenantId = tenantId,
            CategoryId = categoryId,
            FamilyId = familyId,
            HierarchyPathJson = path.Value,
            Kind = kind,
            Name = nameResult.Value!,
            Description = descResult.Value,
            Sku = skuResult.Value,
            BasePrice = priceResult.Value,
            CustomAttributesJson = attrs.Value!,
            IsMatrixParent = true,
            VariantDimensionsJson = dimsResult.Value!,
            Status = CatalogItemStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public static Result<CatalogItem> CreateVariantChild(
        Guid id,
        CatalogItem parent,
        string variantTitle,
        string sku,
        decimal? basePrice,
        string? customAttributesJson,
        string categorySchemaJson,
        Guid? createdBy = null)
    {
        ArgumentNullException.ThrowIfNull(parent);

        if (!parent.IsMatrixParent)
        {
            return Result.Failure<CatalogItem>(
                new Error("catalog.matrix.parent.invalid", "El ítem especificado no es un producto matriz.", ErrorType.Validation));
        }

        if (parent.ParentId.HasValue)
        {
            return Result.Failure<CatalogItem>(
                new Error("catalog.matrix.hierarchy.depth", "No se permite anidar variantes a más de 1 nivel de jerarquía.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(variantTitle))
        {
            return Result.Failure<CatalogItem>(
                new Error("catalog.variant.title.required", "El título de la variante es obligatorio (ej. Talla 35-38).", ErrorType.Validation));
        }

        var skuResult = NormalizeSku(parent.Kind, sku, isMatrixParent: false);
        if (skuResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(skuResult.Error!);
        }

        var priceResult = NormalizePrice(basePrice ?? parent.BasePrice);
        if (priceResult.IsFailure)
        {
            return Result.Failure<CatalogItem>(priceResult.Error!);
        }

        var mergedAttrsJson = CatalogAttributeSchema.MergeAttributes(parent.CustomAttributesJson, customAttributesJson);
        var attrs = CatalogAttributeSchema.NormalizeAttributes(mergedAttrsJson);
        if (attrs.IsFailure)
        {
            return Result.Failure<CatalogItem>(attrs.Error!);
        }

        var combinedName = $"{parent.Name} - {variantTitle.Trim()}";
        if (combinedName.Length > NameMaxLength)
        {
            combinedName = combinedName[..NameMaxLength];
        }

        return new CatalogItem
        {
            Id = id,
            TenantId = parent.TenantId,
            ParentId = parent.Id,
            Parent = parent,
            IsMatrixParent = false,
            CategoryId = parent.CategoryId,
            FamilyId = parent.FamilyId,
            HierarchyPathJson = parent.HierarchyPathJson,
            Kind = parent.Kind,
            Name = combinedName,
            Description = parent.Description,
            Sku = skuResult.Value,
            BasePrice = priceResult.Value,
            CustomAttributesJson = attrs.Value!,
            Status = CatalogItemStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    /// <summary>
    /// Normaliza la ruta jerárquica capturada desde un arquetipo/familia.
    /// Formato canónico: [{ "level": "...", "name": "...", "value": "..." }]. Entradas sin nombre o valor se descartan.
    /// </summary>
    public static Result<string?> NormalizeHierarchyPath(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Result.Success<string?>(null);
        }

        try
        {
            using var doc = JsonDocument.Parse(raw.Trim());
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Result.Failure<string?>(
                    new Error("catalog.item.hierarchy.path.invalid", "La ruta jerárquica debe ser un arreglo JSON.", ErrorType.Validation));
            }

            var entries = new List<object>();
            foreach (var entry in doc.RootElement.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object)
                {
                    return Result.Failure<string?>(
                        new Error("catalog.item.hierarchy.entry.invalid", "Cada nivel de la ruta jerárquica debe ser un objeto JSON.", ErrorType.Validation));
                }

                var level = entry.TryGetProperty("level", out var levelEl) ? levelEl.GetString()?.Trim() : null;
                var name = entry.TryGetProperty("name", out var nameEl) ? nameEl.GetString()?.Trim() : null;
                var value = entry.TryGetProperty("value", out var valueEl) ? valueEl.GetString()?.Trim() : null;

                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(value))
                {
                    continue;
                }

                if (string.IsNullOrEmpty(level))
                {
                    level = name;
                }

                if (level.Length > HierarchyPathTextMaxLength)
                {
                    level = level[..HierarchyPathTextMaxLength];
                }

                if (name.Length > HierarchyPathTextMaxLength)
                {
                    name = name[..HierarchyPathTextMaxLength];
                }

                if (value.Length > NameMaxLength)
                {
                    value = value[..NameMaxLength];
                }

                entries.Add(new { level, name, value });

                if (entries.Count >= HierarchyPathMaxEntries)
                {
                    break;
                }
            }

            return entries.Count == 0
                ? Result.Success<string?>(null)
                : Result.Success<string?>(JsonSerializer.Serialize(entries));
        }
        catch (JsonException)
        {
            return Result.Failure<string?>(
                new Error("catalog.item.hierarchy.path.json", "El formato JSON de la ruta jerárquica no es válido.", ErrorType.Validation));
        }
    }

    public static Result<string> NormalizeVariantDimensions(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Result.Failure<string>(
                new Error("catalog.matrix.dimensions.required", "Debe configurar al menos una dimensión (ej. Talla) para el producto matriz.", ErrorType.Validation));
        }

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(raw.Trim());
            var root = doc.RootElement;
            if (root.ValueKind == System.Text.Json.JsonValueKind.Object &&
                root.TryGetProperty("dimensions", out var wrapped) &&
                wrapped.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                root = wrapped;
            }

            if (root.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                return Result.Failure<string>(
                    new Error("catalog.matrix.dimensions.array", "Las dimensiones de la matriz deben ser un arreglo JSON.", ErrorType.Validation));
            }

            var dimensions = new List<object>();
            foreach (var dim in root.EnumerateArray())
            {
                if (dim.ValueKind != System.Text.Json.JsonValueKind.Object)
                {
                    return Result.Failure<string>(
                        new Error("catalog.matrix.dimension.object", "Cada dimensión debe ser un objeto JSON.", ErrorType.Validation));
                }

                if (!dim.TryGetProperty("name", out var nameEl) || string.IsNullOrWhiteSpace(nameEl.GetString()))
                {
                    return Result.Failure<string>(
                        new Error("catalog.matrix.dimension.name.required", "El nombre de la dimensión (ej. Talla) es obligatorio.", ErrorType.Validation));
                }

                var name = nameEl.GetString()!.Trim();
                if (!dim.TryGetProperty("values", out var valuesEl) || valuesEl.ValueKind != System.Text.Json.JsonValueKind.Array)
                {
                    return Result.Failure<string>(
                        new Error("catalog.matrix.dimension.values.required", $"La dimensión '{name}' debe contener un arreglo de valores.", ErrorType.Validation));
                }

                var values = new List<string>();
                foreach (var v in valuesEl.EnumerateArray())
                {
                    var valStr = v.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(valStr))
                    {
                        values.Add(valStr);
                    }
                }

                if (values.Count == 0)
                {
                    return Result.Failure<string>(
                        new Error("catalog.matrix.dimension.values.empty", $"La dimensión '{name}' debe tener al menos un valor.", ErrorType.Validation));
                }

                dimensions.Add(new { name, values });
            }

            if (dimensions.Count == 0)
            {
                return Result.Failure<string>(
                    new Error("catalog.matrix.dimensions.empty", "Debe definir al menos una dimensión con valores.", ErrorType.Validation));
            }

            return Result.Success(System.Text.Json.JsonSerializer.Serialize(dimensions));
        }
        catch (System.Text.Json.JsonException)
        {
            return Result.Failure<string>(
                new Error("catalog.matrix.dimensions.json", "El formato JSON de las dimensiones no es válido.", ErrorType.Validation));
        }
    }

    public Result Update(
        string name,
        string? description,
        string? sku,
        decimal? basePrice,
        Guid? categoryId,
        string? customAttributesJson,
        string categorySchemaJson,
        Guid? updatedBy,
        Guid? familyId = null,
        string? hierarchyPathJson = null)
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

        var skuResult = NormalizeSku(Kind, sku, IsMatrixParent);
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

        var path = NormalizeHierarchyPath(hierarchyPathJson);
        if (path.IsFailure)
        {
            return Result.Failure(path.Error!);
        }

        Name = nameResult.Value!;
        Description = descResult.Value;
        Sku = skuResult.Value;
        BasePrice = priceResult.Value;
        CategoryId = categoryId;
        FamilyId = familyId;
        HierarchyPathJson = path.Value;
        CustomAttributesJson = PreserveSystemAttributes(CustomAttributesJson, attrs.Value!);
        Touch(updatedBy);
        return Result.Success();
    }

    private static string PreserveSystemAttributes(string? existingJson, string newJson)
    {
        if (string.IsNullOrWhiteSpace(existingJson) || existingJson == CatalogAttributeSchema.EmptyObjectJson)
        {
            return newJson;
        }

        try
        {
            using var oldDoc = JsonDocument.Parse(existingJson);
            if (!oldDoc.RootElement.TryGetProperty("parent_reassignment_history", out var historyEl))
            {
                return newJson;
            }

            using var newDoc = JsonDocument.Parse(newJson);
            if (newDoc.RootElement.TryGetProperty("parent_reassignment_history", out _))
            {
                return newJson;
            }

            var dict = new Dictionary<string, object>();
            foreach (var prop in newDoc.RootElement.EnumerateObject())
            {
                dict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText())!;
            }

            dict["parent_reassignment_history"] = JsonSerializer.Deserialize<object>(historyEl.GetRawText())!;
            return JsonSerializer.Serialize(dict);
        }
        catch
        {
            return newJson;
        }
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

        var skuResult = NormalizeSku(kind, sku, IsMatrixParent);
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

    public const int MaxReassignmentReasonLength = 500;

    /// <summary>
    /// Reasigna una variante a otro producto matriz padre o la desenlaza como producto independiente,
    /// registrando trazabilidad completa y justificación en auditoría jsonb.
    /// </summary>
    public Result ReassignParent(
        CatalogItem? targetParent,
        string reason,
        CatalogItem? previousParent,
        Guid? updatedBy,
        DateTimeOffset utcNow)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure(new Error(
                "catalog.variant.reassign.reason_required",
                "El motivo de reasignación es obligatorio para fines de auditoría.",
                ErrorType.Validation));
        }

        var trimmedReason = reason.Trim();
        if (trimmedReason.Length > MaxReassignmentReasonLength)
        {
            return Result.Failure(new Error(
                "catalog.variant.reassign.reason_length",
                $"El motivo no puede exceder {MaxReassignmentReasonLength} caracteres.",
                ErrorType.Validation));
        }

        if (IsMatrixParent && _variants.Count > 0)
        {
            return Result.Failure(new Error(
                "catalog.variant.reassign.has_children",
                "Un producto matriz con variantes hijas no puede ser reasignado como variante de otro producto.",
                ErrorType.Validation));
        }

        if (targetParent is not null)
        {
            if (targetParent.Id == Id)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.self_parent",
                    "Un producto no puede ser su propio producto matriz padre.",
                    ErrorType.Validation));
            }

            if (targetParent.TenantId != TenantId)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.cross_tenant",
                    "No se permite asignar una variante a un producto de otra empresa.",
                    ErrorType.Validation));
            }

            if (!targetParent.IsMatrixParent)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.target_not_matrix",
                    "El producto destino debe ser un producto matriz padre.",
                    ErrorType.Validation));
            }

            if (targetParent.ParentId.HasValue)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.target_nested",
                    "No se permite jerarquía de variantes a más de 1 nivel de profundidad.",
                    ErrorType.Validation));
            }

            if (targetParent.DeletedAt.HasValue)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.target_deleted",
                    "No se puede reasignar a un producto matriz eliminado o inactivo.",
                    ErrorType.Validation));
            }

            if (targetParent.Kind != Kind)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.kind_mismatch",
                    "El tipo de ítem del destino no coincide con el de la variante (físico vs servicio).",
                    ErrorType.Validation));
            }

            if (ParentId == targetParent.Id)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.already_parent",
                    "La variante ya está asignada a este producto matriz.",
                    ErrorType.Validation));
            }
        }
        else
        {
            if (ParentId is null)
            {
                return Result.Failure(new Error(
                    "catalog.variant.reassign.already_standalone",
                    "El ítem ya es un producto independiente sin producto matriz.",
                    ErrorType.Validation));
            }
        }

        RecordReassignmentAudit(previousParent, targetParent, trimmedReason, updatedBy, utcNow);

        ParentId = targetParent?.Id;
        IsMatrixParent = false;
        Touch(updatedBy);
        return Result.Success();
    }

    private void RecordReassignmentAudit(
        CatalogItem? previousParent,
        CatalogItem? targetParent,
        string reason,
        Guid? updatedBy,
        DateTimeOffset utcNow)
    {
        try
        {
            var dict = new Dictionary<string, object>();
            if (!string.IsNullOrWhiteSpace(CustomAttributesJson) && CustomAttributesJson != CatalogAttributeSchema.EmptyObjectJson)
            {
                using var doc = JsonDocument.Parse(CustomAttributesJson);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    dict[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText())!;
                }
            }

            var historyList = new List<object>();
            if (dict.TryGetValue("parent_reassignment_history", out var existingHistoryObj))
            {
                try
                {
                    var existingHistoryJson = JsonSerializer.Serialize(existingHistoryObj);
                    var parsed = JsonSerializer.Deserialize<List<object>>(existingHistoryJson);
                    if (parsed is not null)
                    {
                        historyList.AddRange(parsed);
                    }
                }
                catch
                {
                    // Fail-safe si el formato anterior era distinto
                }
            }

            historyList.Add(new
            {
                timestamp = utcNow.ToString("O"),
                moved_by = updatedBy?.ToString(),
                reason,
                previous_parent_id = previousParent?.Id.ToString() ?? ParentId?.ToString(),
                previous_parent_name = previousParent?.Name,
                previous_parent_sku = previousParent?.Sku,
                target_parent_id = targetParent?.Id.ToString(),
                target_parent_name = targetParent?.Name,
                target_parent_sku = targetParent?.Sku
            });

            dict["parent_reassignment_history"] = historyList;
            CustomAttributesJson = JsonSerializer.Serialize(dict);
        }
        catch
        {
            // Fail-safe
        }
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

    private static Result<string?> NormalizeSku(CatalogItemKind kind, string? sku, bool isMatrixParent = false)
    {
        if (string.IsNullOrWhiteSpace(sku))
        {
            if (kind == CatalogItemKind.Physical && !isMatrixParent)
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
