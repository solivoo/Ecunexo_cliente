using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Core.Identity;

/// <summary>
/// Credencial Machine-to-Machine (API Key) acotada a un <see cref="Tenant"/> con permisos explícitos (<see cref="Scopes"/>).
/// Nunca almacena el secreto en texto plano; únicamente <see cref="KeyPrefix"/> y <see cref="KeyHash"/> (SHA-256).
/// </summary>
public sealed class TenantApiKey : AggregateRoot<Guid>, ITenantEntity, IAuditable, ISoftDeletable
{
    public const int NameMaxLength = 120;
    public const int KeyPrefixMaxLength = 32;
    public const int KeyHashLength = 64;

    private TenantApiKey()
    {
        Name = string.Empty;
        KeyPrefix = string.Empty;
        KeyHash = string.Empty;
        Scopes = [];
    }

    public Guid TenantId { get; private set; }

    public Tenant? Tenant { get; private set; }

    public string Name { get; private set; }

    /// <summary>Prefijo público identificable (ej. <c>ecx_live_a1b2c3d4</c>).</summary>
    public string KeyPrefix { get; private set; }

    /// <summary>Hash SHA-256 en hexadecimal (minúsculas, 64 caracteres) de la llave completa.</summary>
    public string KeyHash { get; private set; }

    /// <summary>Lista de códigos de permiso autorizados para esta credencial (persistido en <c>jsonb</c>).</summary>
    public List<string> Scopes { get; private set; }

    public DateTimeOffset? ExpiresAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public Guid? RevokedBy { get; private set; }

    public DateTimeOffset? LastUsedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? UpdatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public Guid? UpdatedBy { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public Guid? DeletedBy { get; private set; }

    public static Result<TenantApiKey> Create(
        Guid id,
        Guid tenantId,
        string name,
        string keyPrefix,
        string keyHash,
        IEnumerable<string> scopes,
        Guid? createdByUserId,
        DateTimeOffset? expiresAt,
        DateTimeOffset utcNow)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.id.invalid", "El identificador de la API Key es obligatorio.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.tenant_id.invalid", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.name.required", "El nombre descriptivo de la API Key es obligatorio.", ErrorType.Validation));
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > NameMaxLength)
        {
            return Result.Failure<TenantApiKey>(
                new Error(
                    "api_key.name.length",
                    $"El nombre de la API Key no puede superar {NameMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(keyPrefix) || keyPrefix.Trim().Length > KeyPrefixMaxLength)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.prefix.invalid", "El prefijo de la API Key es inválido.", ErrorType.Validation));
        }

        if (string.IsNullOrWhiteSpace(keyHash) || keyHash.Trim().Length != KeyHashLength)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.hash.invalid", "El hash criptográfico de la API Key es inválido.", ErrorType.Validation));
        }

        var normalizedScopes = scopes
            .Where(static s => !string.IsNullOrWhiteSpace(s))
            .Select(static s => s.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(static s => s, StringComparer.Ordinal)
            .ToList();

        if (normalizedScopes.Count == 0)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.scopes.required", "Debe seleccionar al menos un permiso (scope) para la API Key.", ErrorType.Validation));
        }

        if (expiresAt.HasValue && expiresAt.Value <= utcNow)
        {
            return Result.Failure<TenantApiKey>(
                new Error("api_key.expires_at.past", "La fecha de expiración debe ser futura.", ErrorType.Validation));
        }

        var apiKey = new TenantApiKey
        {
            Id = id,
            TenantId = tenantId,
            Name = trimmedName,
            KeyPrefix = keyPrefix.Trim(),
            KeyHash = keyHash.Trim().ToLowerInvariant(),
            Scopes = normalizedScopes,
            ExpiresAt = expiresAt,
            CreatedAt = utcNow,
            CreatedBy = createdByUserId,
        };

        return Result.Success(apiKey);
    }

    public bool IsActive(DateTimeOffset utcNow) =>
        DeletedAt is null
        && RevokedAt is null
        && (!ExpiresAt.HasValue || ExpiresAt.Value > utcNow);

    public bool HasScope(string permissionCode)
    {
        if (string.IsNullOrWhiteSpace(permissionCode))
        {
            return false;
        }

        var normalized = permissionCode.Trim().ToLowerInvariant();
        return Scopes.Contains(normalized, StringComparer.OrdinalIgnoreCase);
    }

    public Result Revoke(Guid? actorUserId, DateTimeOffset utcNow)
    {
        if (RevokedAt.HasValue)
        {
            return Result.Failure(
                new Error("api_key.already_revoked", "La API Key ya fue revocada.", ErrorType.Conflict));
        }

        RevokedAt = utcNow;
        RevokedBy = actorUserId;
        UpdatedAt = utcNow;
        UpdatedBy = actorUserId;
        return Result.Success();
    }

    public void TouchLastUsed(DateTimeOffset utcNow)
    {
        LastUsedAt = utcNow;
    }
}
