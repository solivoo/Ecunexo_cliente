using System.Diagnostics.CodeAnalysis;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Permiso de catálogo global (no tiene <c>TenantId</c>) — reusable en todos los tenants vía <see cref="RolePermission"/>.
/// </summary>
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "Término de dominio RBAC estándar.")]
public sealed class Permission : AggregateRoot<Guid>, IAuditable, ISoftDeletable
{
    public const int CodeMaxLength = 100;
    public const int DescriptionMaxLength = 500;
    public const int DisplayNameMaxLength = 200;
    public const int ModuleMaxLength = 80;

    private Permission()
    {
        Code = string.Empty;
        RolePermissions = [];
        Policies = [];
    }

    /// <summary>Código estable p. ej. <c>catalog.product.read</c> (minúsculas normalizadas).</summary>
    public string Code { get; private set; }

    /// <summary>Etiqueta legible para menús y tablas de administración.</summary>
    public string? DisplayName { get; private set; }

    /// <summary>Agrupación en la UI; siempre minúsculas (p. ej. <c>identity</c>, <c>catalog</c>).</summary>
    public string? Module { get; private set; }

    /// <summary>Orden relativo dentro del módulo en la UI.</summary>
    public int SortOrder { get; private set; }

    public string? Description { get; private set; }

    public PermissionStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public ICollection<RolePermission> RolePermissions { get; private set; }

    /// <summary>Políticas ABAC que acotan la aplicación del permiso.</summary>
    public ICollection<Policy> Policies { get; private set; }

    public static Result<Permission> Create(
        Guid id,
        string code,
        string? description,
        string? displayName = null,
        string? module = null,
        int sortOrder = 0)
    {
        if (sortOrder < 0)
        {
            return Result.Failure<Permission>(
                new Error("permission.sort_order.range", "El orden debe ser mayor o igual que cero.", ErrorType.Validation));
        }
        if (string.IsNullOrWhiteSpace(code))
        {
            return Result.Failure<Permission>(
                new Error("permission.code.required", "El código del permiso es obligatorio.", ErrorType.Validation));
        }

        var normalized = code.Trim().ToLowerInvariant();
        if (normalized.Length > CodeMaxLength)
        {
            return Result.Failure<Permission>(
                new Error(
                    "permission.code.length",
                    $"El código no puede superar {CodeMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        ReadOnlySpan<char> span = normalized.AsSpan();
        for (var i = 0; i < span.Length; i++)
        {
            var c = span[i];
            if (c is >= 'a' and <= 'z' or '.')
            {
                continue;
            }

            if (c is >= '0' and <= '9')
            {
                continue;
            }

            return Result.Failure<Permission>(
                new Error(
                    "permission.code.format",
                    "El código solo puede usar minúsculas, dígitos y puntos como separador (p. ej. catalog.product.read).",
                    ErrorType.Validation));
        }

        if (normalized.StartsWith('.') || normalized.EndsWith('.') || normalized.Contains(".."))
        {
            return Result.Failure<Permission>(
                new Error("permission.code.format", "El código no puede empezar/terminar en punto ni contener puntos duplicados.", ErrorType.Validation));
        }

        string? desc = null;
        if (description is not null)
        {
            var d = description.Trim();
            if (d.Length > DescriptionMaxLength)
            {
                return Result.Failure<Permission>(
                    new Error(
                        "permission.description.length",
                        $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            desc = d.Length == 0 ? null : d;
        }

        string? dn = null;
        if (displayName is not null)
        {
            var x = displayName.Trim();
            if (x.Length > DisplayNameMaxLength)
            {
                return Result.Failure<Permission>(
                    new Error(
                        "permission.display_name.length",
                        $"El nombre para mostrar no puede superar {DisplayNameMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            dn = x.Length == 0 ? null : x;
        }

        var moduleResult = NormalizeModule(module);
        if (moduleResult.IsFailure)
        {
            return Result.Failure<Permission>(moduleResult.Error!);
        }

        var permission = new Permission
        {
            Id = id,
            Code = normalized,
            DisplayName = dn,
            Module = moduleResult.Value,
            SortOrder = sortOrder,
            Description = desc,
            Status = PermissionStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return permission;
    }

    /// <summary>Normaliza y asigna el módulo (minúsculas). Idempotente si no cambia.</summary>
    public Result SetModule(string? module)
    {
        var normalized = NormalizeModule(module);
        if (normalized.IsFailure)
        {
            return Result.Failure(normalized.Error!);
        }

        if (string.Equals(Module, normalized.Value, StringComparison.Ordinal))
        {
            return Result.Success();
        }

        Module = normalized.Value;
        UpdatedAt = DateTimeOffset.UtcNow;
        return Result.Success();
    }

    private static Result<string?> NormalizeModule(string? module)
    {
        var normalized = TenantModuleCodes.CanonicalizeOrNull(module);
        if (normalized is null)
        {
            return Result.Success((string?)null);
        }

        if (normalized.Length > ModuleMaxLength)
        {
            return Result.Failure<string?>(
                new Error(
                    "permission.module.length",
                    $"El módulo no puede superar {ModuleMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return Result.Success<string?>(normalized);
    }
}
