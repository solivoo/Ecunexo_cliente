using EcuNexo.Core.Common;

namespace EcuNexo.Core.Tenancy;

/// <summary>
/// Lleva el conteo de uso de un límite transaccional por tenant, módulo y clave de límite.
/// Ejemplo: tenant X, módulo "invoicing", límite "max_invoices_per_month", período calendario mensual.
/// Se resetea automáticamente el día 1 del mes al primer incremento del nuevo período.
/// </summary>
public sealed class ModuleUsageCounter : AggregateRoot<Guid>
{
    public const int LimitKeyMaxLength = 64;

    private ModuleUsageCounter()
    {
    }

    public Guid TenantId { get; private set; }

    public string ModuleCode { get; private set; } = string.Empty;

    public string LimitKey { get; private set; } = string.Empty;

    public int CurrentValue { get; private set; }

    /// <summary>Fecha UTC de inicio del período actual (día 1 del mes a las 00:00).</summary>
    public DateTimeOffset PeriodStartUtc { get; private set; }

    /// <summary>Fecha UTC de fin del período actual (día 1 del mes siguiente a las 00:00).</summary>
    public DateTimeOffset PeriodEndUtc { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static ModuleUsageCounter Create(
        Guid id,
        Guid tenantId,
        string moduleCode,
        string limitKey,
        DateTimeOffset utcNow)
    {
        var periodStart = StartOfMonth(utcNow);
        return new ModuleUsageCounter
        {
            Id = id,
            TenantId = tenantId,
            ModuleCode = moduleCode.Trim().ToLowerInvariant(),
            LimitKey = limitKey.Trim().ToLowerInvariant(),
            CurrentValue = 0,
            PeriodStartUtc = periodStart,
            PeriodEndUtc = periodStart.AddMonths(1),
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };
    }

    /// <summary>
    /// Intenta incrementar el contador. Si el período expiró, lo resetea y empieza de 1.
    /// Retorna el nuevo valor.
    /// </summary>
    public int TryIncrement(DateTimeOffset utcNow)
    {
        if (utcNow >= PeriodEndUtc)
        {
            var newPeriodStart = StartOfMonth(utcNow);
            PeriodStartUtc = newPeriodStart;
            PeriodEndUtc = newPeriodStart.AddMonths(1);
            CurrentValue = 1;
        }
        else
        {
            CurrentValue++;
        }

        UpdatedAt = utcNow;
        return CurrentValue;
    }

    /// <summary>
    /// Retorna el valor actual del contador (0 si expiró).
    /// </summary>
    public int GetCurrentValue(DateTimeOffset utcNow)
    {
        if (utcNow >= PeriodEndUtc)
        {
            return 0;
        }

        return CurrentValue;
    }

    /// <summary>
    /// Verifica si el valor actual está dentro del límite (<paramref name="limit"/>).
    /// Si el período expiró, siempre retorna true (contador se resetea a 0 en el próximo incremento).
    /// </summary>
    public bool IsWithinLimit(int limit, DateTimeOffset utcNow)
    {
        if (utcNow >= PeriodEndUtc)
        {
            return true;
        }

        return CurrentValue < limit;
    }

    private static DateTimeOffset StartOfMonth(DateTimeOffset utcNow) =>
        new(utcNow.Year, utcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
}
