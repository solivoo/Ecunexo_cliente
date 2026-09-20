using System.Text.Json;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Catalog;

/// <summary>
/// Plantilla Maestra (Arquetipo) de Producto con jerarquía configurable de N niveles.
/// Permite predefinir la estructura de familias, modelos y variantes físicas
/// (tallas, colores con ColorPicker, fotos por nivel y especificaciones) para
/// generar catálogos complejos o simples en un solo paso.
/// </summary>
public sealed class ProductTemplate : AggregateRoot<Guid>, ITenantEntity, IAuditable
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;
    public const string EmptyArrayJson = "[]";

    private ProductTemplate()
    {
        Name = string.Empty;
        HierarchyTreeJson = EmptyArrayJson;
        IsActive = true;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    /// <summary>
    /// Estructura jerárquica en JSONB con los niveles configurados (nombre de nivel,
    /// atributos vinculados, si usa color/picker, si lleva fotos y modelos/subconjuntos).
    /// </summary>
    public string HierarchyTreeJson { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<ProductTemplate> Create(
        Guid id,
        Guid tenantId,
        string name,
        string? description,
        string hierarchyTreeJson,
        bool isActive = true,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<ProductTemplate>(
                new Error("catalog.product_template.id.invalid", "El id de la plantilla es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<ProductTemplate>(
                new Error("catalog.product_template.tenant.invalid", "El tenant de la plantilla es obligatorio.", ErrorType.Validation));
        }

        var nameNorm = NormalizeName(name);
        if (nameNorm.IsFailure)
        {
            return Result.Failure<ProductTemplate>(nameNorm.Error!);
        }

        var descNorm = NormalizeDescription(description);
        if (descNorm.IsFailure)
        {
            return Result.Failure<ProductTemplate>(descNorm.Error!);
        }

        var treeNorm = NormalizeHierarchyTreeJson(hierarchyTreeJson);
        if (treeNorm.IsFailure)
        {
            return Result.Failure<ProductTemplate>(treeNorm.Error!);
        }

        return new ProductTemplate
        {
            Id = id,
            TenantId = tenantId,
            Name = nameNorm.Value!,
            Description = descNorm.Value,
            HierarchyTreeJson = treeNorm.Value!,
            IsActive = isActive,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public Result Update(
        string name,
        string? description,
        string hierarchyTreeJson,
        bool isActive,
        Guid? updatedBy = null)
    {
        var nameNorm = NormalizeName(name);
        if (nameNorm.IsFailure)
        {
            return Result.Failure(nameNorm.Error!);
        }

        var descNorm = NormalizeDescription(description);
        if (descNorm.IsFailure)
        {
            return Result.Failure(descNorm.Error!);
        }

        var treeNorm = NormalizeHierarchyTreeJson(hierarchyTreeJson);
        if (treeNorm.IsFailure)
        {
            return Result.Failure(treeNorm.Error!);
        }

        Name = nameNorm.Value!;
        Description = descNorm.Value;
        HierarchyTreeJson = treeNorm.Value!;
        IsActive = isActive;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;

        return Result.Success();
    }

    public void Deactivate(Guid? updatedBy = null)
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void Activate(Guid? updatedBy = null)
    {
        IsActive = true;
        UpdatedAt = DateTimeOffset.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static Result<string> NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<string>(
                new Error("catalog.product_template.name.required", "El nombre de la plantilla es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<string>(
                new Error("catalog.product_template.name.length", $"El nombre no puede superar {NameMaxLength} caracteres.", ErrorType.Validation));
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
                new Error("catalog.product_template.description.length", $"La descripción no puede superar {DescriptionMaxLength} caracteres.", ErrorType.Validation));
        }

        return Result.Success<string?>(trimmed);
    }

    private static Result<string> NormalizeHierarchyTreeJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Result.Success(EmptyArrayJson);
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            return Result.Success(json.Trim());
        }
        catch (JsonException)
        {
            return Result.Failure<string>(
                new Error("catalog.product_template.tree.invalid_json", "La estructura del árbol de niveles debe ser un JSON válido.", ErrorType.Validation));
        }
    }
}
