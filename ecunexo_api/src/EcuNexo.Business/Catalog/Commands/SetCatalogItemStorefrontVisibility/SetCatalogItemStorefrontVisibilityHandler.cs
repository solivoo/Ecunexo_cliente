using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Catalog.Commands.SetCatalogItemStorefrontVisibility;

public sealed class SetCatalogItemStorefrontVisibilityHandler
    : ICommandHandler<SetCatalogItemStorefrontVisibilityCommand, SetCatalogItemStorefrontVisibilityResponse>
{
    private readonly ICatalogItemRepository _items;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICallerContext _caller;

    public SetCatalogItemStorefrontVisibilityHandler(
        ICatalogItemRepository items,
        IUnitOfWork unitOfWork,
        ICallerContext caller)
    {
        _items = items;
        _unitOfWork = unitOfWork;
        _caller = caller;
    }

    public async Task<Result<SetCatalogItemStorefrontVisibilityResponse>> Handle(
        SetCatalogItemStorefrontVisibilityCommand command,
        CancellationToken ct)
    {
        if (command.TenantId == Guid.Empty || command.ItemId == Guid.Empty)
        {
            return Result.Failure<SetCatalogItemStorefrontVisibilityResponse>(
                new Error(
                    "catalog.item.visibility.validation",
                    "Tenant e ítem son obligatorios.",
                    ErrorType.Validation));
        }

        var item = await _items.GetTrackedByIdAsync(command.TenantId, command.ItemId, ct)
            .ConfigureAwait(false);
        if (item is null)
        {
            return Result.Failure<SetCatalogItemStorefrontVisibilityResponse>(
                new Error("catalog.item.not_found", "El ítem no existe.", ErrorType.NotFound));
        }

        var updated = item.SetStorefrontVisibility(command.Hidden, _caller.UserId);
        if (updated.IsFailure)
        {
            return Result.Failure<SetCatalogItemStorefrontVisibilityResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new SetCatalogItemStorefrontVisibilityResponse(item.Id, item.TenantId, item.IsHiddenFromStorefront));
    }
}
