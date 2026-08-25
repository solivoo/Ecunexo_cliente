using System.Diagnostics.CodeAnalysis;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Vincula un <see cref="Role"/> de tenant con un <see cref="Permission"/> global.
/// </summary>
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "Término de dominio RBAC estándar.")]
public sealed class RolePermission : IAuditable
{
    private RolePermission()
    {
        Role = null!;
        Permission = null!;
    }

    public Guid RoleId { get; private set; }

    public Guid PermissionId { get; private set; }

    public Role Role { get; private set; }

    public Permission Permission { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<RolePermission> Link(Guid roleId, Guid permissionId)
    {
        if (roleId == Guid.Empty)
        {
            return Result.Failure<RolePermission>(
                new Error("role_permission.role_id.invalid", "El rol es obligatorio.", ErrorType.Validation));
        }

        if (permissionId == Guid.Empty)
        {
            return Result.Failure<RolePermission>(
                new Error("role_permission.permission_id.invalid", "El permiso es obligatorio.", ErrorType.Validation));
        }

        var row = new RolePermission
        {
            RoleId = roleId,
            PermissionId = permissionId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return row;
    }
}
