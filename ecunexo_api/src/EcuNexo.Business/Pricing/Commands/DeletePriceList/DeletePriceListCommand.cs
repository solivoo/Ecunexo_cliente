using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Customers.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.DeletePriceList;

public sealed record DeletePriceListCommand(
    Guid TenantId,
    Guid PriceListId,
    bool Permanent = false) : ICommand<DeletePriceListResponse>;

public sealed record DeletePriceListResponse(Guid PriceListId, bool IsActive, bool Removed = false);

public sealed class DeletePriceListHandler : ICommandHandler<DeletePriceListCommand, DeletePriceListResponse>
{
    private readonly IPriceListRepository _priceLists;
    private readonly IProductPriceRepository _productPrices;
    private readonly ICustomerRepository _customers;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public DeletePriceListHandler(
        IPriceListRepository priceLists,
        IProductPriceRepository productPrices,
        ICustomerRepository customers,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _priceLists = priceLists;
        _productPrices = productPrices;
        _customers = customers;
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

        if (command.Permanent)
        {
            if (list.IsDefault)
            {
                return Result.Failure<DeletePriceListResponse>(
                    new Error(
                        "catalog.pricing.price_list.default",
                        "No puedes eliminar la lista predeterminada; asigna otra como predeterminada primero.",
                        ErrorType.Conflict));
            }

            if (await _productPrices.HasPricesForListAsync(command.TenantId, list.Id, ct).ConfigureAwait(false))
            {
                return Result.Failure<DeletePriceListResponse>(
                    new Error(
                        "catalog.pricing.price_list.has_prices",
                        "La lista tiene precios asociados; desactívala en lugar de eliminarla.",
                        ErrorType.Conflict));
            }

            if (await _customers.HasPriceListAssignmentAsync(command.TenantId, list.Id, ct).ConfigureAwait(false))
            {
                return Result.Failure<DeletePriceListResponse>(
                    new Error(
                        "catalog.pricing.price_list.assigned",
                        "La lista está asignada a clientes; quítala de sus fichas antes de eliminarla.",
                        ErrorType.Conflict));
            }

            await _priceLists.RemoveAsync(list, ct).ConfigureAwait(false);
            await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
            return Result.Success(new DeletePriceListResponse(list.Id, false, true));
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
