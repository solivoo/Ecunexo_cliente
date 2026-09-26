using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.UpdatePriceList;

public sealed record UpdatePriceListCommand(
    Guid TenantId,
    Guid PriceListId,
    string Name,
    string? Description,
    string? Currency,
    bool PricesIncludeTax,
    DateOnly ValidFrom,
    DateOnly? ValidTo,
    int Priority,
    bool IsDefault) : ICommand<UpdatePriceListResponse>;

public sealed record UpdatePriceListResponse(Guid PriceListId, Guid TenantId);

public sealed class UpdatePriceListHandler : ICommandHandler<UpdatePriceListCommand, UpdatePriceListResponse>
{
    private readonly IPriceListRepository _priceLists;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public UpdatePriceListHandler(
        IPriceListRepository priceLists,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _priceLists = priceLists;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdatePriceListResponse>> Handle(
        UpdatePriceListCommand command,
        CancellationToken ct)
    {
        var list = await _priceLists.GetTrackedByIdAsync(command.TenantId, command.PriceListId, ct)
            .ConfigureAwait(false);
        if (list is null)
        {
            return Result.Failure<UpdatePriceListResponse>(
                new Error("catalog.pricing.price_list.not_found", "La lista de precios no existe.", ErrorType.NotFound));
        }

        if (command.IsDefault)
        {
            var currentDefault = await _priceLists.GetDefaultTrackedAsync(command.TenantId, ct).ConfigureAwait(false);
            if (currentDefault is not null && currentDefault.Id != list.Id)
            {
                var demote = currentDefault.SetDefault(false, _caller.UserId);
                if (demote.IsFailure)
                {
                    return Result.Failure<UpdatePriceListResponse>(demote.Error!);
                }
            }
        }
        else if (list.IsDefault)
        {
            return Result.Failure<UpdatePriceListResponse>(
                new Error("catalog.pricing.price_list.default.required", "Asigne otra lista como predeterminada antes de quitar esta condición.", ErrorType.Validation));
        }

        var updated = list.Update(
            command.Name,
            command.Description,
            command.Currency,
            command.PricesIncludeTax,
            command.ValidFrom,
            command.ValidTo,
            command.Priority,
            _caller.UserId);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdatePriceListResponse>(updated.Error!);
        }

        var setDefault = list.SetDefault(command.IsDefault, _caller.UserId);
        if (setDefault.IsFailure)
        {
            return Result.Failure<UpdatePriceListResponse>(setDefault.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdatePriceListResponse(list.Id, list.TenantId));
    }
}
