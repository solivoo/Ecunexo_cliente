using System.Globalization;
using System.Text;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Unidad organizacional del tenant (catálogo para asignar a usuarios).
/// </summary>
public sealed class Department : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;

    /// <summary>Departamento de sistema al provisionar la empresa. El administrador nace aquí.</summary>
    public const string AdministrationName = "Administración";

    public const string AdministrationDescription = "Dirección y administración de la empresa.";

    private Department()
    {
        Name = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    public string? Description { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<Department> Create(Guid id, Guid tenantId, string name, string? description = null)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Department>(
                new Error("department.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Department>(
                new Error("department.name.required", "El nombre del departamento es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<Department>(
                new Error(
                    "department.name.length",
                    $"El nombre del departamento no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        string? desc = null;
        if (description is not null)
        {
            var d = description.Trim();
            if (d.Length > DescriptionMaxLength)
            {
                return Result.Failure<Department>(
                    new Error(
                        "department.description.length",
                        $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            desc = d.Length == 0 ? null : d;
        }

        return new Department
        {
            Id = id,
            TenantId = tenantId,
            Name = trimmed,
            Description = desc,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }

    public static Result<Department> CreateAdministration(Guid id, Guid tenantId) =>
        Create(id, tenantId, AdministrationName, AdministrationDescription);

    /// <summary>Corrige nombre o descripción (p. ej. tilde). No cambia la identidad.</summary>
    public Result Rename(string name, string? description)
    {
        if (DeletedAt is not null)
        {
            return Result.Failure(
                new Error(
                    "department.deleted",
                    "No se puede editar un departamento dado de baja.",
                    ErrorType.Conflict));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure(
                new Error("department.name.required", "El nombre del departamento es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure(
                new Error(
                    "department.name.length",
                    $"El nombre del departamento no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        string? desc = null;
        if (description is not null)
        {
            var d = description.Trim();
            if (d.Length > DescriptionMaxLength)
            {
                return Result.Failure(
                    new Error(
                        "department.description.length",
                        $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            desc = d.Length == 0 ? null : d;
        }

        Name = trimmed;
        Description = desc;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    /// <summary>Baja lógica: deja de listarse. Conserva historial.</summary>
    public Result SoftDelete(DateTimeOffset utcNow, Guid? deletedBy = null)
    {
        if (DeletedAt is not null)
        {
            return Result.Success();
        }

        DeletedAt = utcNow;
        DeletedBy = deletedBy;
        UpdatedAt = utcNow;
        return Result.Success();
    }

    /// <summary>«Administracion» y «Administración» son el mismo departamento de sistema.</summary>
    public static bool IsAdministrationAlias(string? name) =>
        name is not null && NamesMatchIgnoreDiacritics(name, AdministrationName);

    public static bool NamesMatchIgnoreDiacritics(string left, string right) =>
        string.Equals(NormalizeNameKey(left), NormalizeNameKey(right), StringComparison.Ordinal);

    public static string NormalizeNameKey(string name)
    {
        var formD = name.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(formD.Length);
        foreach (var ch in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(ch);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}
