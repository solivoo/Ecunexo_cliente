using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.UpdateProductPrice;

public sealed record UpdateProductPriceCommand(
    Guid TenantId,
    Guid ProductPriceId,
    decimal Price,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    string? Reason,
    bool? IsActive = null,
    IReadOnlyList<PriceTierInput>? Tiers = null) : ICommand<UpdateProductPriceResponse>;

public sealed record UpdateProductPriceResponse(Guid ProductPriceId, Guid TenantId);

public sealed class UpdateProductPriceHandler
    : ICommandHandler<UpdateProductPriceCommand, UpdateProductPriceResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceChangeLogRepository _priceHistory;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateProductPriceHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IProductPriceRepository productPrices,
        IPriceChangeLogRepository priceHistory,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _productPrices = productPrices;
        _priceHistory = priceHistory;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateProductPriceResponse>> Handle(
        UpdateProductPriceCommand command,
        CancellationToken ct)
    {
        var price = await _productPrices.GetTrackedByIdAsync(command.TenantId, command.ProductPriceId, ct)
            .ConfigureAwait(false);
        if (price is null)
        {
            return Result.Failure<UpdateProductPriceResponse>(
                new Error("catalog.pricing.product_price.not_found", "El precio no existe.", ErrorType.NotFound));
        }

        var overlap = await _productPrices
            .GetOverlappingTrackedAsync(
                command.TenantId,
                price.PriceListId,
                price.CatalogItemId,
                command.ValidFrom,
                command.ValidTo,
                price.Id,
                ct)
            .ConfigureAwait(false);
        if (overlap is not null)
        {
            return Result.Failure<UpdateProductPriceResponse>(
                new Error("catalog.pricing.price.overlap", "La vigencia se superpone con otro precio del mismo producto y lista.", ErrorType.Conflict));
        }

        var previousPrice = price.Price;

        var changed = price.ChangePrice(command.Price, _caller.UserId);
        if (changed.IsFailure)
        {
            return Result.Failure<UpdateProductPriceResponse>(changed.Error!);
        }

        var validity = price.SetValidity(command.ValidFrom, command.ValidTo, _caller.UserId);
        if (validity.IsFailure)
        {
            return Result.Failure<UpdateProductPriceResponse>(validity.Error!);
        }

        if (command.IsActive is { } isActive)
        {
            price.SetActive(isActive, _caller.UserId);
        }

        if (command.Tiers is not null)
        {
            foreach (var existing in price.Tiers.ToList())
            {
                price.DeactivateTier(existing.Id, _caller.UserId);
            }

            foreach (var tier in command.Tiers)
            {
                var added = price.AddTier(_idGenerator.NewId(), tier.QuantityFrom, tier.QuantityTo, tier.UnitPrice, _caller.UserId);
                if (added.IsFailure)
                {
                    return Result.Failure<UpdateProductPriceResponse>(added.Error!);
                }
            }
        }

        var log = PriceChangeLog.Create(
            _idGenerator.NewId(),
            command.TenantId,
            price.PriceListId,
            price.CatalogItemId,
            previousPrice,
            command.Price,
            command.ValidFrom,
            command.ValidTo,
            command.Reason,
            _caller.UserId);
        if (log.IsFailure)
        {
            return Result.Failure<UpdateProductPriceResponse>(log.Error!);
        }

        await _priceHistory.AddAsync(log.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new UpdateProductPriceResponse(price.Id, price.TenantId));
    }
}
