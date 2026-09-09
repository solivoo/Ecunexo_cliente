using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Catalog;

/// <summary>Clasificación de ítems del tenant. El molde jsonb vive en <see cref="AttributeSchemaJson"/>.</summary>
public sealed class Category : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;

    private Category()
    {
        Name = string.Empty;
        AttributeSchemaJson = CatalogAttributeSchema.EmptyArrayJson;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public Guid? ParentId { get; private set; }

    public Category? Parent { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public string AttributeSchemaJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<Category> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? description = null,
        Guid? parentId = null,
        string? attributeSchemaJson = null)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Category>(
                new Error("catalog.category.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (parentId == id)
        {
            return Result.Failure<Category>(
                new Error(
                    "catalog.category.parent.self",
                    "Una categoría no puede ser padre de sí misma.",
                    ErrorType.Validation));
        }

        var nameResult = NormalizeName(name);
        if (nameResult.IsFailure)
        {
            return Result.Failure<Category>(nameResult.Error!);
        }

        var descResult = NormalizeDescription(description);
        if (descResult.IsFailure)
        {
            return Result.Failure<Category>(descResult.Error!);
        }

        var schema = CatalogAttributeSchema.NormalizeSchema(attributeSchemaJson);
        if (schema.IsFailure)
        {
            return Result.Failure<Category>(schema.Error!);
        }

        return new Category
        {
            Id = id,
            TenantId = tenantId,
            ParentId = parentId,
            Name = nameResult.Value!,
            Description = descResult.Value,
            AttributeSchemaJson = schema.Value!,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public Result Rename(string name, string? description, Guid? updatedBy)
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

        Name = nameResult.Value!;
        Description = descResult.Value;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetParent(Guid? parentId, Guid? updatedBy)
    {
        if (parentId == Id)
        {
            return Result.Failure(
                new Error(
                    "catalog.category.parent.self",
                    "Una categoría no puede ser padre de sí misma.",
                    ErrorType.Validation));
        }

        ParentId = parentId;
        Touch(updatedBy);
        return Result.Success();
    }

    public Result SetAttributeSchema(string? attributeSchemaJson, Guid? updatedBy)
    {
        var schema = CatalogAttributeSchema.NormalizeSchema(attributeSchemaJson);
        if (schema.IsFailure)
        {
            return Result.Failure(schema.Error!);
        }

        AttributeSchemaJson = schema.Value!;
        Touch(updatedBy);
        return Result.Success();
    }

    /// <summary>Baja lógica: deja de listarse. El caller valida ítems hijos / subcategorías.</summary>
    public Result SoftDelete(DateTimeOffset utcNow, Guid? deletedBy = null)
    {
        if (DeletedAt is not null)
        {
            return Result.Success();
        }

        DeletedAt = utcNow;
        DeletedBy = deletedBy;
        Touch(deletedBy);
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
                new Error("catalog.category.name.required", "El nombre de la categoría es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error(
                    "catalog.category.name.length",
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
                    "catalog.category.description.length",
                    $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed.Length == 0 ? null : trimmed);
    }
}
