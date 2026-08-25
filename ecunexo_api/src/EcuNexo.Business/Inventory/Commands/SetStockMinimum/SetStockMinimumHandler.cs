using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using FluentValidation;

namespace EcuNexo.Business.Inventory.Commands.SetStockMinimum;

public sealed class SetStockMinimumHandler : ICommandHandler<SetStockMinimumCommand, SetStockMinimumResponse>
{
    private readonly IValidator<SetStockMinimumCommand> _validator;
    private readonly IStockRepository _stocks;
    private readonly IUnitOfWork _unitOfWork;

    public SetStockMinimumHandler(
        IValidator<SetStockMinimumCommand> validator,
        IStockRepository stocks,
        IUnitOfWork unitOfWork)
    {
        _validator = validator;
        _stocks = stocks;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SetStockMinimumResponse>> Handle(
        SetStockMinimumCommand command,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(command, ct).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            var message = string.Join(' ', validation.Errors.Select(e => e.ErrorMessage));
            return Result.Failure<SetStockMinimumResponse>(
                new Error("inventory.stock.minimum.validation", message, ErrorType.Validation));
        }

        var stock = await _stocks.GetTrackedByIdAsync(command.TenantId, command.StockId, ct)
            .ConfigureAwait(false);
        if (stock is null)
        {
            return Result.Failure<SetStockMinimumResponse>(
                new Error("inventory.stock.not_found", "El saldo no existe.", ErrorType.NotFound));
        }

        var updated = stock.SetMinimumQuantity(command.MinimumQuantity, updatedBy: null);
        if (updated.IsFailure)
        {
            return Result.Failure<SetStockMinimumResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(
            new SetStockMinimumResponse(
                stock.Id,
                stock.Quantity,
                stock.MinimumQuantity,
                stock.IsBelowMinimum));
    }
}
