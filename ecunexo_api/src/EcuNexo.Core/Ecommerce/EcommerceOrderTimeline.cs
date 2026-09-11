using EcuNexo.Core.Common;

namespace EcuNexo.Core.Ecommerce;

/// <summary>
/// Evento de trazabilidad y auditoría inmutable en la línea de tiempo de la orden.
/// </summary>
public sealed class EcommerceOrderTimeline : Entity<Guid>
{
    private EcommerceOrderTimeline()
    {
    }

    public Guid EcommerceOrderId { get; private set; }

    public EcommerceOrderStatus? PreviousStatus { get; private set; }

    public EcommerceOrderStatus NewStatus { get; private set; }

    public string? Notes { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    public Guid? UserId { get; private set; }

    public string? UserName { get; private set; }

    public static EcommerceOrderTimeline Create(
        Guid id,
        Guid ecommerceOrderId,
        EcommerceOrderStatus? previousStatus,
        EcommerceOrderStatus newStatus,
        string? notes,
        Guid? userId,
        string? userName)
    {
        return new EcommerceOrderTimeline
        {
            Id = id,
            EcommerceOrderId = ecommerceOrderId,
            PreviousStatus = previousStatus,
            NewStatus = newStatus,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            OccurredAt = DateTimeOffset.UtcNow,
            UserId = userId,
            UserName = string.IsNullOrWhiteSpace(userName) ? null : userName.Trim(),
        };
    }
}
