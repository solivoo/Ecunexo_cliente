using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Tenancy;

namespace EcuNexo.Business.Tenancy.Licensing;

public sealed class ModuleUsageTracker : IModuleUsageTracker
{
    private readonly IModuleUsageCounterRepository _counters;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IIdGenerator _idGenerator;

    public ModuleUsageTracker(
        IModuleUsageCounterRepository counters,
        IUnitOfWork unitOfWork,
        IIdGenerator idGenerator)
    {
        _counters = counters;
        _unitOfWork = unitOfWork;
        _idGenerator = idGenerator;
    }

    public async Task<Result> TryIncrementAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        int limit,
        CancellationToken ct)
    {
        var normalizedModule = moduleCode.Trim().ToLowerInvariant();
        var normalizedKey = limitKey.Trim().ToLowerInvariant();
        var utcNow = DateTimeOffset.UtcNow;

        var counter = await _counters.GetAsync(tenantId, normalizedModule, normalizedKey, ct)
            .ConfigureAwait(false);

        if (counter is null)
        {
            counter = ModuleUsageCounter.Create(
                _idGenerator.NewId(),
                tenantId,
                normalizedModule,
                normalizedKey,
                utcNow);
            await _counters.AddAsync(counter, ct).ConfigureAwait(false);
        }

        if (!counter.IsWithinLimit(limit, utcNow))
        {
            return Result.Failure(
                new Error(
                    "limit.exceeded",
                    $"Límite «{limitKey}» del módulo «{moduleCode}» excedido ({counter.GetCurrentValue(utcNow)}/{limit}).",
                    ErrorType.Forbidden));
        }

        counter.TryIncrement(utcNow);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success();
    }

    public async Task<int> GetCurrentValueAsync(
        Guid tenantId,
        string moduleCode,
        string limitKey,
        CancellationToken ct)
    {
        var utcNow = DateTimeOffset.UtcNow;
        var counter = await _counters.GetAsync(tenantId, moduleCode, limitKey, ct).ConfigureAwait(false);
        return counter?.GetCurrentValue(utcNow) ?? 0;
    }
}
