using EcuNexo.Core.Identity;

namespace EcuNexo.Business.Identity;

/// <summary>
/// Persistencia de <see cref="User"/> — implementado en <c>EcuNexo.Data</c>.
/// </summary>
public interface IUserRepository
{
    Task AddAsync(User user, CancellationToken ct);

    Task<IReadOnlyList<User>> ListActiveByTenantAsync(Guid tenantId, CancellationToken ct);

    Task<User?> GetActiveByIdAsync(Guid tenantId, Guid userId, CancellationToken ct);

    /// <summary>Usuario activo con seguimiento EF para actualizaciones.</summary>
    Task<User?> GetActiveByIdForUpdateAsync(Guid tenantId, Guid userId, CancellationToken ct);

    /// <summary>Usuario activo por correo, con seguimiento EF para actualizaciones (p. ej. login).</summary>
    Task<User?> GetActiveByEmailForUpdateAsync(Guid tenantId, Email email, CancellationToken ct);

    /// <summary>
    /// Usuario activo por correo cuando el tenant no se conoce en el cliente (login solo email/contraseña).
    /// Devuelve null si no hay coincidencia única.
    /// </summary>
    Task<User?> GetActiveByEmailForLoginAsync(Email email, CancellationToken ct);

    /// <summary>
    /// Indica si ya existe un usuario activo (no eliminado) con el mismo correo (normalizado) en el tenant.
    /// </summary>
    Task<bool> EmailExistsAsync(Guid tenantId, Email email, CancellationToken ct);

    Task<IReadOnlyList<User>> ListActiveByDepartmentIdForUpdateAsync(
        Guid tenantId,
        Guid departmentId,
        CancellationToken ct);
}
