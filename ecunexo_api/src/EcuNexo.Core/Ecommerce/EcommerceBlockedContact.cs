using EcuNexo.Core.Common;

namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Contacto (correo o teléfono) bloqueado para crear pedidos desde la tienda pública.
/// </summary>
public sealed class EcommerceBlockedContact : Entity<Guid>
{
    public const int ValueNormalizedMaxLength = 200;
    public const int ReasonMaxLength = 500;

    private EcommerceBlockedContact()
    {
    }

    public Guid TenantId { get; private set; }

    public EcommerceBlockedContactKind Kind { get; private set; }

    public string ValueNormalized { get; private set; } = string.Empty;

    public string? Reason { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public static Result<EcommerceBlockedContact> Create(
        Guid id,
        Guid tenantId,
        EcommerceBlockedContactKind kind,
        string? value,
        string? reason = null,
        Guid? createdBy = null)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error("ecommerce.blocked_contact.id_empty", "El id del contacto bloqueado no puede ser vacío.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error("ecommerce.blocked_contact.tenant_required", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (!Enum.IsDefined(kind))
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error("ecommerce.blocked_contact.kind_invalid", "El tipo de contacto bloqueado no es válido.", ErrorType.Validation));
        }

        var normalized = Normalize(kind, value);
        if (normalized.Length == 0)
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error("ecommerce.blocked_contact.value_required", "El valor del contacto es obligatorio.", ErrorType.Validation));
        }

        if (normalized.Length > ValueNormalizedMaxLength)
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error(
                    "ecommerce.blocked_contact.value_length",
                    $"El valor del contacto no puede superar {ValueNormalizedMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        var trimmedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (trimmedReason is { Length: > ReasonMaxLength })
        {
            return Result.Failure<EcommerceBlockedContact>(
                new Error(
                    "ecommerce.blocked_contact.reason_length",
                    $"El motivo no puede superar {ReasonMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return new EcommerceBlockedContact
        {
            Id = id,
            TenantId = tenantId,
            Kind = kind,
            ValueNormalized = normalized,
            Reason = trimmedReason,
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
        };
    }

    /// <summary>Normaliza el valor según el tipo (correo en minúsculas o solo dígitos).</summary>
    public static string Normalize(EcommerceBlockedContactKind kind, string? value) =>
        kind switch
        {
            EcommerceBlockedContactKind.Email => EcommerceContactNormalizer.NormalizeEmail(value),
            EcommerceBlockedContactKind.Phone => EcommerceContactNormalizer.NormalizePhone(value),
            _ => string.Empty,
        };
}
