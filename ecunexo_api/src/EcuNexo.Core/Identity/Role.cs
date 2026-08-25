using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Rol RBAC acotado a un <see cref="Tenancy.Tenant"/> — aísla permisos por inquilino.
/// </summary>
public sealed class Role : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;

    private Role()
    {
        Name = string.Empty;
        UserRoles = [];
        RolePermissions = [];
    }

    public Guid TenantId { get; private set; }

    /// <summary>Tenant dueño — navegación ORM.</summary>
    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    /// <summary>Texto auxiliar para la UI (tooltip, tarjeta de rol).</summary>
    public string? Description { get; private set; }

    /// <summary>Si es true, la UI puede ocultar eliminación o tratarlo como rol de plataforma.</summary>
    public bool IsSystem { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public ICollection<UserRole> UserRoles { get; private set; }

    public ICollection<RolePermission> RolePermissions { get; private set; }

    public static Result<Role> Create(Guid id, Guid tenantId, string name, string? description = null, bool isSystem = false)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<Role>(
                new Error("role.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<Role>(
                new Error("role.name.required", "El nombre del rol es obligatorio.", ErrorType.Validation));
        }

        var trimmed = name.Trim();
        if (trimmed.Length > NameMaxLength)
        {
            return Result.Failure<Role>(
                new Error(
                    "role.name.length",
                    $"El nombre del rol no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        string? desc = null;
        if (description is not null)
        {
            var d = description.Trim();
            if (d.Length > DescriptionMaxLength)
            {
                return Result.Failure<Role>(
                    new Error(
                        "role.description.length",
                        $"La descripción no puede superar {DescriptionMaxLength} caracteres.",
                        ErrorType.Validation));
            }

            desc = d.Length == 0 ? null : d;
        }

        var role = new Role
        {
            Id = id,
            TenantId = tenantId,
            Name = trimmed,
            Description = desc,
            IsSystem = isSystem,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return role;
    }
}
