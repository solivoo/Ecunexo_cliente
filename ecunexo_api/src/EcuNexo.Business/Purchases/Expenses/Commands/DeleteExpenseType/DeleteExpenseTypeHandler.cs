using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Expenses.Commands.DeleteExpenseType;

public sealed class DeleteExpenseTypeHandler : ICommandHandler<DeleteExpenseTypeCommand, bool>
{
    private readonly IExpenseTypeRepository _expenseTypes;
    private readonly IPurchaseRepository _purchases;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteExpenseTypeHandler(
        IExpenseTypeRepository expenseTypes,
        IPurchaseRepository purchases,
        IUnitOfWork unitOfWork)
    {
        _expenseTypes = expenseTypes;
        _purchases = purchases;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteExpenseTypeCommand command, CancellationToken ct)
    {
        var expenseType = await _expenseTypes.GetTrackedByIdAsync(command.TenantId, command.ExpenseTypeId, ct).ConfigureAwait(false);
        if (expenseType is null)
        {
            return Result.Failure<bool>(
                new Error("purchases.expense_type.not_found", "La categoría de compra no existe.", ErrorType.NotFound));
        }

        if (expenseType.IsSystem)
        {
            return Result.Failure<bool>(
                new Error("purchases.expense_type.system_immutable", "Los conceptos base del SRI no pueden eliminarse. Puedes desactivarlos para que no aparezcan en nuevas compras.", ErrorType.Validation));
        }

        // Si ya está referenciado en facturas de compra existentes, desactivar en lugar de borrar físicamente
        var isUsed = await _purchases.ExistsByExpenseTypeIdAsync(command.TenantId, command.ExpenseTypeId, ct).ConfigureAwait(false);
        if (isUsed)
        {
            expenseType.Deactivate(command.DeletedBy);
        }
        else
        {
            _expenseTypes.Remove(expenseType);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(true);
    }
}
