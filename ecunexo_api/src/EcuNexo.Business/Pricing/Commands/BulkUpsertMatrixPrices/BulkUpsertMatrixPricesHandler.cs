using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;
using FluentValidation;

namespace EcuNexo.Business.Pricing.Commands.BulkUpsertMatrixPrices;

/// <summary>
/// Upsert atómico multi-lista para la matriz de precios: actualiza precios existentes con la misma fecha
/// de inicio o cierra vigencias anteriores abiertas y crea las nuevas en una sola transacción sin N+1.
/// </summary>
public sealed class BulkUpsertMatrixPricesHandler
    : ICommandHandler<BulkUpsertMatrixPricesCommand, BulkUpsertMatrixPricesResponse>
{
    private readonly IValidator<BulkUpsertMatrixPricesCommand> _validator;
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceChangeLogRepository _priceHistory;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public BulkUpsertMatrixPricesHandler(
        IValidator<BulkUpsertMatrixPricesCommand> validator,
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

    public async Task<Result<BulkUpsertMatrixPricesResponse>> Handle(
        BulkUpsertMatrixPricesCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<BulkUpsertMatrixPricesResponse>(
                new Error("catalog.pricing.matrix.validation", message, ErrorType.Validation));
        }

        var listIds = command.Entries.Select(e => e.PriceListId).Distinct().ToList();
        var itemIds = command.Entries.Select(e => e.CatalogItemId).Distinct().ToList();

        var tenantLists = await _priceLists.ListAsync(command.TenantId, onlyActive: false, ct)
            .ConfigureAwait(false);
        var listsById = tenantLists.ToDictionary(l => l.Id);
        foreach (var listId in listIds)
        {
            if (!listsById.ContainsKey(listId))
            {
                return Result.Failure<BulkUpsertMatrixPricesResponse>(
                    new Error(
                        "catalog.pricing.price_list.not_found",
                        "Una o más listas de precios no existen.",
                        ErrorType.NotFound));
            }
        }

        var items = await _items.GetActiveByIdsAsync(command.TenantId, itemIds, ct).ConfigureAwait(false);
        var itemsById = items.ToDictionary(i => i.Id);
        foreach (var itemId in itemIds)
        {
            if (!itemsById.ContainsKey(itemId))
            {
                return Result.Failure<BulkUpsertMatrixPricesResponse>(
                    new Error(
                        "catalog.pricing.matrix.item_not_found",
                        "Uno o más productos no existen o están inactivos.",
                        ErrorType.NotFound));
            }
        }

        var existingPrices = await _productPrices
            .ListTrackedForBulkUpsertAsync(
                command.TenantId,
                listIds,
                itemIds,
                command.ValidFrom,
                command.ValidTo,
                ct)
            .ConfigureAwait(false);

        var maxDate = command.ValidTo ?? DateOnly.MaxValue;
        var groupedExisting = existingPrices
            .GroupBy(p => (p.PriceListId, p.CatalogItemId))
            .ToDictionary(g => g.Key, g => g.ToList());

        var updatedCount = 0;
        var createdCount = 0;

        foreach (var entry in command.Entries)
        {
            var item = itemsById[entry.CatalogItemId];
            var key = (entry.PriceListId, entry.CatalogItemId);
            groupedExisting.TryGetValue(key, out var candidates);

            var exact = candidates?.FirstOrDefault(p => p.ValidFrom == command.ValidFrom);
            if (exact is not null)
            {
                var previousPrice = exact.Price;
                var changed = exact.ChangePrice(entry.Price, _caller.UserId);
                if (changed.IsFailure)
                {
                    return Result.Failure<BulkUpsertMatrixPricesResponse>(changed.Error!);
                }

                var validity = exact.SetValidity(command.ValidFrom, command.ValidTo, _caller.UserId);
                if (validity.IsFailure)
                {
                    return Result.Failure<BulkUpsertMatrixPricesResponse>(validity.Error!);
                }

                if (!exact.IsActive)
                {
                    exact.SetActive(true, _caller.UserId);
                }

                var updateLog = PriceChangeLog.Create(
                    _idGenerator.NewId(),
                    command.TenantId,
                    entry.PriceListId,
                    entry.CatalogItemId,
                    previousPrice,
                    entry.Price,
                    command.ValidFrom,
                    command.ValidTo,
                    command.Reason,
                    _caller.UserId);
                if (updateLog.IsFailure)
                {
                    return Result.Failure<BulkUpsertMatrixPricesResponse>(updateLog.Error!);
                }

                await _priceHistory.AddAsync(updateLog.Value!, ct).ConfigureAwait(false);
                updatedCount++;
                continue;
            }

            decimal? prevPrice = null;
            var overlap = candidates?
                .Where(p => p.IsActive
                    && p.ValidFrom <= maxDate
                    && (p.ValidTo is null || p.ValidTo.Value >= command.ValidFrom))
                .OrderBy(p => p.ValidFrom)
                .FirstOrDefault();

            if (overlap is not null)
            {
                if (overlap.ValidFrom < command.ValidFrom)
                {
                    prevPrice = overlap.Price;
                    var close = overlap.SetValidity(overlap.ValidFrom, command.ValidFrom.AddDays(-1), _caller.UserId);
                    if (close.IsFailure)
                    {
                        return Result.Failure<BulkUpsertMatrixPricesResponse>(close.Error!);
                    }
                }
                else
                {
                    return Result.Failure<BulkUpsertMatrixPricesResponse>(
                        new Error(
                            "catalog.pricing.matrix.overlap",
                            $"«{item.Name}» ya tiene un precio que se superpone con la vigencia indicada.",
                            ErrorType.Conflict));
                }
            }

            var created = ProductPrice.Create(
                _idGenerator.NewId(),
                command.TenantId,
                entry.PriceListId,
                entry.CatalogItemId,
                entry.Price,
                command.ValidFrom,
                command.ValidTo,
                _caller.UserId);
            if (created.IsFailure)
            {
                return Result.Failure<BulkUpsertMatrixPricesResponse>(created.Error!);
            }

            await _productPrices.AddAsync(created.Value!, ct).ConfigureAwait(false);

            var createLog = PriceChangeLog.Create(
                _idGenerator.NewId(),
                command.TenantId,
                entry.PriceListId,
                entry.CatalogItemId,
                prevPrice,
                entry.Price,
                command.ValidFrom,
                command.ValidTo,
                command.Reason,
                _caller.UserId);
            if (createLog.IsFailure)
            {
                return Result.Failure<BulkUpsertMatrixPricesResponse>(createLog.Error!);
            }

            await _priceHistory.AddAsync(createLog.Value!, ct).ConfigureAwait(false);
            createdCount++;
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new BulkUpsertMatrixPricesResponse(updatedCount, createdCount));
    }
}
