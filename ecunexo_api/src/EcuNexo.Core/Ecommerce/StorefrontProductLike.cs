using EcuNexo.Core.Common;

namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// "Me gusta" de un visitante anónimo de la vitrina sobre un producto raíz del catálogo.
/// La identidad es el <see cref="VisitorId"/> opaco generado por el navegador (localStorage).
/// </summary>
public sealed class StorefrontProductLike : Entity<Guid>
{
    public const int VisitorIdMaxLength = 64;

    private StorefrontProductLike()
    {
        VisitorId = string.Empty;
    }

    public Guid TenantId { get; private set; }

    public Guid CatalogItemId { get; private set; }

    public string VisitorId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static Result<StorefrontProductLike> Create(
        Guid id,
        Guid tenantId,
        Guid catalogItemId,
        string? visitorId)
    {
        if (id == Guid.Empty)
        {
            return Result.Failure<StorefrontProductLike>(
                new Error("ecommerce.like.id_empty", "El id del like no puede ser vacío.", ErrorType.Validation));
        }

        if (tenantId == Guid.Empty)
        {
            return Result.Failure<StorefrontProductLike>(
                new Error("ecommerce.like.tenant_required", "El tenant es obligatorio.", ErrorType.Validation));
        }

        if (catalogItemId == Guid.Empty)
        {
            return Result.Failure<StorefrontProductLike>(
                new Error("ecommerce.like.item_required", "El producto es obligatorio.", ErrorType.Validation));
        }

        var normalized = visitorId?.Trim() ?? string.Empty;
        if (normalized.Length == 0 || normalized.Length > VisitorIdMaxLength)
        {
            return Result.Failure<StorefrontProductLike>(
                new Error(
                    "ecommerce.like.visitor_invalid",
                    $"El visitante debe tener entre 1 y {VisitorIdMaxLength} caracteres.",
                    ErrorType.Validation));
        }

        return new StorefrontProductLike
        {
            Id = id,
            TenantId = tenantId,
            CatalogItemId = catalogItemId,
            VisitorId = normalized,
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}
