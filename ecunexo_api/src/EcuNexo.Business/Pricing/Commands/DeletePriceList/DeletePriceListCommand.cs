using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.DeletePriceList;

public sealed record DeletePriceListCommand(Guid TenantId, Guid PriceListId) : ICommand<DeletePriceListResponse>;

public sealed record DeletePriceListResponse(Guid PriceListId, bool IsActive);

public sealed class DeletePriceListHandler : ICommandHandler<DeletePriceListCommand, DeletePriceListResponse>
{
    private readonly IPriceListRepository _priceLists;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public DeletePriceListHandler(
        IPriceListRepository priceLists,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _priceLists = priceLists;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeletePriceListResponse>> Handle(
        DeletePriceListCommand command,
        CancellationToken ct)
    {
        var list = await _priceLists.GetTrackedByIdAsync(command.TenantId, command.PriceListId, ct)
            .ConfigureAwait(false);
        if (list is null)
        {
            return Result.Failure<DeletePriceListResponse>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        var deactivated = list.SetActive(false, _caller.UserId);
        if (deactivated.IsFailure)
        {
            return Result.Failure<DeletePriceListResponse>(deactivated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new DeletePriceListResponse(list.Id, list.IsActive));
    }
}
