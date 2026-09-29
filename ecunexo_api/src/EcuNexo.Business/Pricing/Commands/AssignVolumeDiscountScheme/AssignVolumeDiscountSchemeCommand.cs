using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.AssignVolumeDiscountScheme;

public sealed record AssignVolumeDiscountSchemeCommand(
    Guid TenantId,
    Guid PriceListId,
    Guid? VolumeDiscountSchemeId,
    IReadOnlyList<Guid> CatalogItemIds) : ICommand<AssignVolumeDiscountSchemeResponse>;

public sealed record AssignVolumeDiscountSchemeResponse(int AssignedCount);

public sealed class AssignVolumeDiscountSchemeHandler : ICommandHandler<AssignVolumeDiscountSchemeCommand, AssignVolumeDiscountSchemeResponse>
{
    private readonly ICallerContext _caller;
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly IVolumeDiscountSchemeRepository _schemes;
    private readonly IUnitOfWork _unitOfWork;

    public AssignVolumeDiscountSchemeHandler(
        ICallerContext caller,
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        IVolumeDiscountSchemeRepository schemes,
        IUnitOfWork unitOfWork)
    {
        _caller = caller;
        _priceLists = priceLists;
        _productPrices = productPrices;
        _schemes = schemes;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AssignVolumeDiscountSchemeResponse>> Handle(
        AssignVolumeDiscountSchemeCommand command,
        CancellationToken ct)
    {
        if (command.CatalogItemIds.Count == 0)
        {
            return Result.Success(new AssignVolumeDiscountSchemeResponse(0));
        }

        var priceList = await _priceLists.GetByIdAsync(command.TenantId, command.PriceListId, ct).ConfigureAwait(false);
        if (priceList is null)
        {
            return Result.Failure<AssignVolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        if (command.VolumeDiscountSchemeId.HasValue)
        {
            var scheme = await _schemes.GetByIdAsync(command.TenantId, command.VolumeDiscountSchemeId.Value, ct).ConfigureAwait(false);
            if (scheme is null || !scheme.IsActive)
            {
                return Result.Failure<AssignVolumeDiscountSchemeResponse>(
                    new Error("catalog.pricing.volume_scheme.not_found", "El esquema de descuento no existe o está inactivo.", ErrorType.NotFound));
            }
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var assigned = 0;

        foreach (var itemId in command.CatalogItemIds.Distinct())
        {
            var vigentPrice = await _productPrices.GetVigentAsync(
                command.TenantId,
                command.PriceListId,
                itemId,
                today,
                ct).ConfigureAwait(false);

            if (vigentPrice is not null)
            {
                var tracked = await _productPrices.GetTrackedByIdAsync(command.TenantId, vigentPrice.Id, ct).ConfigureAwait(false);
                if (tracked is not null)
                {
                    tracked.AssignVolumeDiscountScheme(command.VolumeDiscountSchemeId, _caller.UserId);
                    assigned++;
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new AssignVolumeDiscountSchemeResponse(assigned));
    }
}
