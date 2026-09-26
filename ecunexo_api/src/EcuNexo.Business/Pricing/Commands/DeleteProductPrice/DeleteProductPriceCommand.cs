using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.DeleteProductPrice;

public sealed record DeleteProductPriceCommand(
    Guid TenantId,
    Guid ProductPriceId,
    string? Reason = null) : ICommand<DeleteProductPriceResponse>;

public sealed record DeleteProductPriceResponse(Guid ProductPriceId, bool IsActive);

public sealed class DeleteProductPriceHandler
    : ICommandHandler<DeleteProductPriceCommand, DeleteProductPriceResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IProductPriceRepository _productPrices;
    private readonly IPriceChangeLogRepository _priceHistory;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteProductPriceHandler(
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

    public async Task<Result<DeleteProductPriceResponse>> Handle(
        DeleteProductPriceCommand command,
        CancellationToken ct)
    {
        var price = await _productPrices.GetTrackedByIdAsync(command.TenantId, command.ProductPriceId, ct)
            .ConfigureAwait(false);
        if (price is null)
        {
            return Result.Failure<DeleteProductPriceResponse>(
                new Error("catalog.pricing.product_price.not_found", "El precio no existe.", ErrorType.NotFound));
        }

        price.SetActive(false, _caller.UserId);

        var log = PriceChangeLog.Create(
            _idGenerator.NewId(),
            command.TenantId,
            price.PriceListId,
            price.CatalogItemId,
            price.Price,
            null,
            price.ValidFrom,
            price.ValidTo,
            command.Reason ?? "Desactivación de precio",
            _caller.UserId);
        if (log.IsFailure)
        {
            return Result.Failure<DeleteProductPriceResponse>(log.Error!);
        }

        await _priceHistory.AddAsync(log.Value!, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new DeleteProductPriceResponse(price.Id, price.IsActive));
    }
}
