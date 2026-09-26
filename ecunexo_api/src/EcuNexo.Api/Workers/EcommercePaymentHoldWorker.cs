using EcuNexo.Business.Ecommerce.Storefront;

namespace EcuNexo.Api.Workers;

/// <summary>
/// Libera periódicamente las reservas de stock de pedidos que superaron su TTL de pago.
/// </summary>
public sealed partial class EcommercePaymentHoldWorker : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EcommercePaymentHoldWorker> _logger;

    public EcommercePaymentHoldWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<EcommercePaymentHoldWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                LogUnexpectedError(_logger, ex);
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
                {
                    break;
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<EcommercePaymentHoldService>();

        var outcome = await service
            .RunAsync(DateTimeOffset.UtcNow, EcommercePaymentHoldService.DefaultBatchSize, ct)
            .ConfigureAwait(false);

        if (outcome.Errors.Count > 0)
        {
            LogWithErrors(
                _logger,
                outcome.Scanned,
                outcome.Cancelled,
                outcome.Skipped,
                outcome.Errors.Count,
                string.Join(" | ", outcome.Errors));
        }
        else
        {
            LogSummary(_logger, outcome.Scanned, outcome.Cancelled, outcome.Skipped);
        }
    }

    [LoggerMessage(
        EventId = 9401,
        Level = LogLevel.Error,
        Message = "Error inesperado al liberar reservas ecommerce expiradas.")]
    private static partial void LogUnexpectedError(ILogger logger, Exception exception);

    [LoggerMessage(
        EventId = 9402,
        Level = LogLevel.Warning,
        Message = "Reservas ecommerce: {Scanned} revisadas, {Cancelled} liberadas, {Skipped} vigentes, {Failed} con error. Detalle: {Errors}")]
    private static partial void LogWithErrors(
        ILogger logger,
        int scanned,
        int cancelled,
        int skipped,
        int failed,
        string errors);

    [LoggerMessage(
        EventId = 9403,
        Level = LogLevel.Information,
        Message = "Reservas ecommerce: {Scanned} revisadas, {Cancelled} liberadas, {Skipped} vigentes.")]
    private static partial void LogSummary(
        ILogger logger,
        int scanned,
        int cancelled,
        int skipped);
}
