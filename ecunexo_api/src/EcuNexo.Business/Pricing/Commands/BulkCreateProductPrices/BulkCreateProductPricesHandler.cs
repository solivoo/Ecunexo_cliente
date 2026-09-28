using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;
using FluentValidation;

namespace EcuNexo.Business.Pricing.Commands.BulkCreateProductPrices;

/// <summary>
/// Carga masiva: crea una nueva vigencia de precio por producto en una sola transacción,
/// cerrando la vigencia abierta anterior y registrando historial por ítem.
/// </summary>
public sealed class BulkCreateProductPricesHandler
    : ICommandHandler<BulkCreateProductPricesCommand, BulkCreateProductPricesResponse>
{
    private readonly IValidator<BulkCreateProductPricesCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceChangeLogRepository _priceHistory;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public BulkCreateProductPricesHandler(
        IValidator<BulkCreateProductPricesCommand> validator,
        IIdGenerator idGenerator,
        ICallerContext caller,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        IPriceChangeLogRepository priceHistory,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _idGenerator = idGenerator;
        _caller = caller;
        _priceLists = priceLists;
        _productPrices = productPrices;
        _priceHistory = priceHistory;
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<BulkCreateProductPricesResponse>> Handle(
        BulkCreateProductPricesCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<BulkCreateProductPricesResponse>(
                new Error("catalog.pricing.bulk.validation", message, ErrorType.Validation));
        }

        var list = await _priceLists.GetTrackedByIdAsync(command.TenantId, command.PriceListId, ct)
            .ConfigureAwait(false);
        if (list is null)
        {
            return Result.Failure<BulkCreateProductPricesResponse>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        var itemIds = command.Items.Select(i => i.CatalogItemId).Distinct().ToList();
        var items = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);
        var itemsById = items.ToDictionary(i => i.Id);

        foreach (var input in command.Items)
        {
            if (!itemsById.TryGetValue(input.CatalogItemId, out _))
            {
                return Result.Failure<BulkCreateProductPricesResponse>(
                    new Error(
                        "catalog.pricing.bulk.item_not_found",
                        "Uno o más productos no existen o están inactivos.",
                        ErrorType.NotFound));
            }
        }

        var createdCount = 0;
        foreach (var input in command.Items)
        {
            var item = itemsById[input.CatalogItemId];
            decimal? previousPrice = null;

            var existing = await _productPrices
                .GetByExactStartTrackedAsync(command.TenantId, list.Id, item.Id, command.ValidFrom, ct)
                .ConfigureAwait(false);
            if (existing is not null)
            {
                previousPrice = existing.Price;
                var changed = existing.ChangePrice(input.Price, _caller.UserId);
                if (changed.IsFailure)
                {
                    return Result.Failure<BulkCreateProductPricesResponse>(changed.Error!);
                }

                var validity = existing.SetValidity(command.ValidFrom, command.ValidTo, _caller.UserId);
                if (validity.IsFailure)
                {
                    return Result.Failure<BulkCreateProductPricesResponse>(validity.Error!);
                }

                if (!existing.IsActive)
                {
                    existing.SetActive(true, _caller.UserId);
                }

                if (input.Tiers is { Count: > 0 })
                {
                    foreach (var tier in existing.Tiers.ToList())
                    {
                        existing.DeactivateTier(tier.Id, _caller.UserId);
                    }

                    foreach (var tier in input.Tiers)
                    {
                        var added = existing.AddTier(_idGenerator.NewId(), tier.QuantityFrom, tier.QuantityTo, tier.UnitPrice, _caller.UserId);
                        if (added.IsFailure)
                        {
                            return Result.Failure<BulkCreateProductPricesResponse>(added.Error!);
                        }
                    }
                }

                var upsertLog = PriceChangeLog.Create(
                    _idGenerator.NewId(),
                    command.TenantId,
                    list.Id,
                    item.Id,
                    previousPrice,
                    input.Price,
                    command.ValidFrom,
                    command.ValidTo,
                    command.Reason,
                    _caller.UserId);
                if (upsertLog.IsFailure)
                {
                    return Result.Failure<BulkCreateProductPricesResponse>(upsertLog.Error!);
                }

                await _priceHistory.AddAsync(upsertLog.Value!, ct).ConfigureAwait(false);
                createdCount++;
                continue;
            }

            var overlap = await _productPrices
                .GetOverlappingTrackedAsync(
                    command.TenantId,
                    list.Id,
                    item.Id,
                    command.ValidFrom,
                    command.ValidTo,
                    null,
                    ct)
                .ConfigureAwait(false);

            if (overlap is not null)
            {
                if (overlap.ValidFrom < command.ValidFrom)
                {
                    previousPrice = overlap.Price;
                    var close = overlap.SetValidity(overlap.ValidFrom, command.ValidFrom.AddDays(-1), _caller.UserId);
                    if (close.IsFailure)
                    {
                        return Result.Failure<BulkCreateProductPricesResponse>(close.Error!);
                    }
                }
                else
                {
                    return Result.Failure<BulkCreateProductPricesResponse>(
                        new Error(
                            "catalog.pricing.bulk.overlap",
                            $"«{item.Name}» ya tiene un precio que se superpone con la vigencia indicada.",
                            ErrorType.Conflict));
                }
            }

            var created = ProductPrice.Create(
                _idGenerator.NewId(),
                command.TenantId,
                list.Id,
                item.Id,
                input.Price,
                command.ValidFrom,
                command.ValidTo,
                _caller.UserId);
            if (created.IsFailure)
            {
                return Result.Failure<BulkCreateProductPricesResponse>(created.Error!);
            }

            if (input.Tiers is { Count: > 0 })
            {
                foreach (var tier in input.Tiers)
                {
                    var added = created.Value!.AddTier(
                        _idGenerator.NewId(),
                        tier.QuantityFrom,
                        tier.QuantityTo,
                        tier.UnitPrice,
                        _caller.UserId);
                    if (added.IsFailure)
                    {
                        return Result.Failure<BulkCreateProductPricesResponse>(added.Error!);
                    }
                }
            }

            await _productPrices.AddAsync(created.Value!, ct).ConfigureAwait(false);

            var log = PriceChangeLog.Create(
                _idGenerator.NewId(),
                command.TenantId,
                list.Id,
                item.Id,
                previousPrice,
                input.Price,
                command.ValidFrom,
                command.ValidTo,
                command.Reason,
                _caller.UserId);
            if (log.IsFailure)
            {
                return Result.Failure<BulkCreateProductPricesResponse>(log.Error!);
            }

            await _priceHistory.AddAsync(log.Value!, ct).ConfigureAwait(false);
            createdCount++;
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new BulkCreateProductPricesResponse(list.Id, createdCount));
    }
}
