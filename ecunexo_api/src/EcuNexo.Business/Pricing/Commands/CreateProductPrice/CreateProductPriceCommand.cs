using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Catalog;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.CreateProductPrice;

public sealed record CreateProductPriceCommand(
    Guid TenantId,
    Guid PriceListId,
    Guid CatalogItemId,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    IReadOnlyList<PriceTierInput>? Tiers = null,
    bool IsActive = true) : ICommand<CreateProductPriceResponse>;

public sealed record CreateProductPriceResponse(Guid ProductPriceId, Guid TenantId);

public sealed class CreateProductPriceHandler
    : ICommandHandler<CreateProductPriceCommand, CreateProductPriceResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceChangeLogRepository _priceHistory;
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;

    public CreateProductPriceHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        IPriceChangeLogRepository priceHistory,
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _priceLists = priceLists;
        _productPrices = productPrices;
        _priceHistory = priceHistory;
        _items = items;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<CreateProductPriceResponse>> Handle(
        CreateProductPriceCommand command,
        CancellationToken ct)
    {
        var list = await _priceLists.GetTrackedByIdAsync(command.TenantId, command.PriceListId, ct)
            .ConfigureAwait(false);
        if (list is null)
        {
            return Result.Failure<CreateProductPriceResponse>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        var item = await _items.GetActiveByIdAsync(command.TenantId, command.CatalogItemId, ct)
            .ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<CreateProductPriceResponse>(
                new Error("catalog.pricing.item.not_found", "El producto no existe o está inactivo.", ErrorType.NotFound));
        }

        decimal? previousPrice = null;

        // Upsert: si ya existe un precio (activo o no) con la misma fecha de inicio, se actualiza
        // en lugar de insertar (evita violar el índice único tenant+lista+ítem+desde).
        var existing = await _productPrices
            .GetByExactStartTrackedAsync(command.TenantId, list.Id, item.Id, command.ValidFrom, ct)
            .ConfigureAwait(false);
        if (existing is not null)
        {
            previousPrice = existing.Price;
            var changed = existing.ChangePrice(command.Price, _caller.UserId);
            if (changed.IsFailure)
            {
                return Result.Failure<CreateProductPriceResponse>(changed.Error!);
            }

            var validity = existing.SetValidity(command.ValidFrom, command.ValidTo, _caller.UserId);
            if (validity.IsFailure)
            {
                return Result.Failure<CreateProductPriceResponse>(validity.Error!);
            }

            if (!existing.IsActive)
            {
                existing.SetActive(true, _caller.UserId);
            }

            if (command.Tiers is not null)
            {
                foreach (var tier in existing.Tiers.ToList())
                {
                    existing.DeactivateTier(tier.Id, _caller.UserId);
                }

                foreach (var tier in command.Tiers)
                {
                    var added = existing.AddTier(_idGenerator.NewId(), tier.QuantityFrom, tier.QuantityTo, tier.UnitPrice, _caller.UserId);
                    if (added.IsFailure)
                    {
                        return Result.Failure<CreateProductPriceResponse>(added.Error!);
                    }
                }
            }

            var upsertLog = PriceChangeLog.Create(
                _idGenerator.NewId(),
                command.TenantId,
                list.Id,
                item.Id,
                previousPrice,
                command.Price,
                command.ValidFrom,
                command.ValidTo,
                command.Reason,
                _caller.UserId);
            if (upsertLog.IsFailure)
            {
                return Result.Failure<CreateProductPriceResponse>(upsertLog.Error!);
            }

            await _priceHistory.AddAsync(upsertLog.Value!, ct).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Result.Success(new CreateProductPriceResponse(existing.Id, existing.TenantId));
        }

        var overlap = await _productPrices
            .GetOverlappingTrackedAsync(command.TenantId, list.Id, item.Id, command.ValidFrom, command.ValidTo, null, ct)
            .ConfigureAwait(false);
        if (overlap is not null)
        {
            if (overlap.ValidFrom < command.ValidFrom)
            {
                previousPrice = overlap.Price;
                var close = overlap.SetValidity(overlap.ValidFrom, command.ValidFrom.AddDays(-1), _caller.UserId);
                if (close.IsFailure)
                {
                    return Result.Failure<CreateProductPriceResponse>(close.Error!);
                }
            }
            else
            {
                return Result.Failure<CreateProductPriceResponse>(
                    new Error("catalog.pricing.price.overlap", "Ya existe un precio vigente que se superpone con la vigencia indicada.", ErrorType.Conflict));
            }
        }

        var created = ProductPrice.Create(
            _idGenerator.NewId(),
            command.TenantId,
            list.Id,
            item.Id,
            command.Price,
            command.ValidFrom,
            command.ValidTo,
            _caller.UserId);
        if (created.IsFailure)
        {
            return Result.Failure<CreateProductPriceResponse>(created.Error!);
        }

        var price = created.Value!;
        if (!command.IsActive)
        {
            var deactivate = price.SetActive(false, _caller.UserId);
            if (deactivate.IsFailure)
            {
                return Result.Failure<CreateProductPriceResponse>(deactivate.Error!);
            }
        }

        if (command.Tiers is { Count: > 0 })
        {
            foreach (var tier in command.Tiers)
            {
                var added = price.AddTier(_idGenerator.NewId(), tier.QuantityFrom, tier.QuantityTo, tier.UnitPrice, _caller.UserId);
                if (added.IsFailure)
                {
                    return Result.Failure<CreateProductPriceResponse>(added.Error!);
                }
            }
        }

        await _productPrices.AddAsync(price, ct).ConfigureAwait(false);

        var log = PriceChangeLog.Create(
            _idGenerator.NewId(),
            command.TenantId,
            list.Id,
            item.Id,
            previousPrice,
            command.Price,
            command.ValidFrom,
            command.ValidTo,
            command.Reason,
            _caller.UserId);
        if (log.IsFailure)
        {
            return Result.Failure<CreateProductPriceResponse>(log.Error!);
        }

        await _priceHistory.AddAsync(log.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreateProductPriceResponse(price.Id, price.TenantId));
    }
}
