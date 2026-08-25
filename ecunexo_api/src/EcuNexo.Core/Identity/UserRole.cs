using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Asignación de un <see cref="Role"/> a un <see cref="User"/> dentro del mismo tenant.
/// </summary>
public sealed class UserRole : ITenantEntity, IAuditable
{
    private UserRole()
    {
        User = null!;
        Role = null!;
    }

    public Guid TenantId { get; private set; }

    public Guid UserId { get; private set; }

    public Guid RoleId { get; private set; }

    public User User { get; private set; }

    public Role Role { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public static Result<UserRole> Assign(Guid tenantId, Guid userId, Guid roleId)
    {
        if (tenantId == Guid.Empty)
        {
            return Result.Failure<UserRole>(
                new Error("user_role.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (userId == Guid.Empty)
        {
            return Result.Failure<UserRole>(
                new Error("user_role.user_id.invalid", "El usuario es obligatorio.", ErrorType.Validation));
        }

        if (roleId == Guid.Empty)
        {
            return Result.Failure<UserRole>(
                new Error("user_role.role_id.invalid", "El rol es obligatorio.", ErrorType.Validation));
        }

        var link = new UserRole
        {
            TenantId = tenantId,
            UserId = userId,
            RoleId = roleId,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        return link;
    }
}
