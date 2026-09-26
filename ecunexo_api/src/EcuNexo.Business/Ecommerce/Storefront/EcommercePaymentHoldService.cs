using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Ecommerce.Commands.CancelEcommerceOrder;
using EcuNexo.Business.Ecommerce.Repositories;

namespace EcuNexo.Business.Ecommerce.Storefront;

/// <summary>Resumen de una pasada del mantenimiento de reservas expiradas por falta de pago.</summary>
public sealed record EcommercePaymentHoldOutcome(
    int Scanned,
    int Cancelled,
    int Skipped,
    IReadOnlyList<string> Errors);

/// <summary>
/// Cancela pedidos pendientes de pago cuyo TTL (<c>payment_hold_hours</c>) ya expiró, liberando la reserva de stock.
/// </summary>
public sealed class EcommercePaymentHoldService
{
    public const int DefaultBatchSize = 50;
    public const string ExpirationReason = "Expirado por falta de pago";
    public const string SystemUserName = "Sistema";

    /// <summary>
    /// Cota inferior de antigüedad para no barrer toda la tabla en cada pasada.
    /// Es el TTL mínimo permitido (1 h); el TTL real por tenant se evalúa al cancelar.
    /// </summary>
    public static readonly TimeSpan ExpirationLookback = TimeSpan.FromHours(1);

    private readonly IEcommerceOrderRepository _orders;
    private readonly IEcommerceStorefrontSettingsReader _settings;
    private readonly ISender _sender;

    public EcommercePaymentHoldService(
        IEcommerceOrderRepository orders,
        IEcommerceStorefrontSettingsReader settings,
        ISender sender)
    {
        _orders = orders;
        _settings = settings;
        _sender = sender;
    }

    public async Task<EcommercePaymentHoldOutcome> RunAsync(
        DateTimeOffset now,
        int batchSize,
        CancellationToken ct)
    {
        var limit = batchSize > 0 ? batchSize : DefaultBatchSize;
        var candidates = await _orders
            .ListPendingPaymentBeforeAsync(now - ExpirationLookback, limit, ct)
            .ConfigureAwait(false);

        var cancelled = 0;
        var skipped = 0;
        var errors = new List<string>();

        foreach (var order in candidates)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var settings = await _settings.ResolveAsync(order.TenantId, ct).ConfigureAwait(false);
                var expiresAt = order.OrderDate.AddHours(settings.PaymentHoldHours);
                if (now < expiresAt)
                {
                    skipped++;
                    continue;
                }

                var result = await _sender
                    .SendAsync<CancelEcommerceOrderCommand, CancelEcommerceOrderResponse>(
                        new CancelEcommerceOrderCommand(
                            order.TenantId,
                            order.Id,
                            ExpirationReason,
                            UserId: null,
                            UserName: SystemUserName),
                        ct)
                    .ConfigureAwait(false);

                if (result.IsSuccess)
                {
                    cancelled++;
                }
                else
                {
                    errors.Add($"{order.Id}: {result.Error!.Code} - {result.Error.Message}");
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                errors.Add($"{order.Id}: {ex.Message}");
            }
        }

        return new EcommercePaymentHoldOutcome(candidates.Count, cancelled, skipped, errors);
    }
}
