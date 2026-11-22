using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;
using FluentValidation;

namespace EcuNexo.Business.Logistics.Commands.UpsertCantonShippingRatesBulk;

public sealed record CantonShippingRateUpsertItem(
    Guid CantonId,
    decimal BasePrice,
    decimal BaseWeightKg,
    decimal AdditionalKgPrice,
    decimal VolumetricDivisor,
    bool RoundUpExtraKg,
    decimal? FreeShippingMinAmount,
    decimal TaxRate,
    string? EstimatedDays,
    bool IsEnabled);

public sealed record UpsertCantonShippingRatesBulkCommand(
    Guid TenantId,
    Guid? ShippingMethodId,
    IReadOnlyList<CantonShippingRateUpsertItem> Items,
    Guid? OriginCantonId = null) : ICommand<UpsertCantonShippingRatesBulkResponse>;

public sealed record UpsertCantonShippingRatesBulkResponse(int UpsertedCount);

public sealed class UpsertCantonShippingRatesBulkValidator
    : AbstractValidator<UpsertCantonShippingRatesBulkCommand>
{
    public UpsertCantonShippingRatesBulkValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("Debe enviar al menos un cantón.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.CantonId).NotEmpty();
            item.RuleFor(i => i.BasePrice).GreaterThanOrEqualTo(0);
            item.RuleFor(i => i.BaseWeightKg).GreaterThan(0);
            item.RuleFor(i => i.AdditionalKgPrice).GreaterThanOrEqualTo(0);
            item.RuleFor(i => i.VolumetricDivisor).GreaterThan(0);
            item.RuleFor(i => i.TaxRate).InclusiveBetween(0, 100);
        });
    }
}

public sealed class UpsertCantonShippingRatesBulkHandler
    : ICommandHandler<UpsertCantonShippingRatesBulkCommand, UpsertCantonShippingRatesBulkResponse>
{
    private readonly ICantonShippingRateRepository _rates;
    private readonly IShippingMethodRepository _methods;
    private readonly IEcuadorGeoRepository _geo;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public UpsertCantonShippingRatesBulkHandler(
        ICantonShippingRateRepository rates,
        IShippingMethodRepository methods,
        IEcuadorGeoRepository geo,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _rates = rates;
        _methods = methods;
        _geo = geo;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpsertCantonShippingRatesBulkResponse>> Handle(
        UpsertCantonShippingRatesBulkCommand command,
        CancellationToken ct)
    {
        if (command.ShippingMethodId is { } methodId && command.OriginCantonId is { } originCantonId)
        {
            var method = await _methods.GetByIdAsync(command.TenantId, methodId, ct).ConfigureAwait(false);
            var originCanton = await _geo.GetCantonByIdAsync(originCantonId, ct).ConfigureAwait(false);
            if (method is not null && originCanton is not null && method.CoverageScope != ShippingCoverageScope.National)
            {
                foreach (var item in command.Items.Where(i => i.IsEnabled))
                {
                    var destCanton = await _geo.GetCantonByIdAsync(item.CantonId, ct).ConfigureAwait(false);
                    if (destCanton is not null)
                    {
                        var routeValidation = method.ValidateRoute(originCanton.ProvinceId, destCanton.ProvinceId);
                        if (routeValidation.IsFailure)
                        {
                            return Result.Failure<UpsertCantonShippingRatesBulkResponse>(routeValidation.Error!);
                        }
                    }
                }
            }
        }

        var cantonIds = command.Items.Select(i => i.CantonId).Distinct().ToList();
        var existing = await _rates
            .ListTrackedByCantonsAsync(command.TenantId, cantonIds, command.ShippingMethodId, command.OriginCantonId, ct)
            .ConfigureAwait(false);
        var existingByCanton = existing.ToDictionary(r => r.CantonId);

        var count = 0;
        foreach (var item in command.Items)
        {
            if (existingByCanton.TryGetValue(item.CantonId, out var current))
            {
                var updated = current.Update(
                    item.BasePrice,
                    item.BaseWeightKg,
                    item.AdditionalKgPrice,
                    item.VolumetricDivisor,
                    item.RoundUpExtraKg,
                    item.FreeShippingMinAmount,
                    item.TaxRate,
                    item.EstimatedDays,
                    item.IsEnabled);
                if (updated.IsFailure)
                {
                    return Result.Failure<UpsertCantonShippingRatesBulkResponse>(updated.Error!);
                }
            }
            else
            {
                var created = CantonShippingRate.Create(
                    _idGenerator.NewId(),
                    command.TenantId,
                    item.CantonId,
                    command.ShippingMethodId,
                    item.BasePrice,
                    item.BaseWeightKg,
                    item.AdditionalKgPrice,
                    item.VolumetricDivisor,
                    item.RoundUpExtraKg,
                    item.FreeShippingMinAmount,
                    item.TaxRate,
                    item.EstimatedDays,
                    item.IsEnabled,
                    originCantonId: command.OriginCantonId);
                if (created.IsFailure)
                {
                    return Result.Failure<UpsertCantonShippingRatesBulkResponse>(created.Error!);
                }

                await _rates.AddAsync(created.Value!, ct).ConfigureAwait(false);
            }

            count++;
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpsertCantonShippingRatesBulkResponse(count));
    }
}
