using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Purchases.Expenses.Commands.UpdateExpenseType;

public sealed class UpdateExpenseTypeHandler : ICommandHandler<UpdateExpenseTypeCommand, ExpenseTypeResponse>
{
    private readonly IExpenseTypeRepository _expenseTypes;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateExpenseTypeHandler(
        IExpenseTypeRepository expenseTypes,
        IUnitOfWork unitOfWork)
    {
        _expenseTypes = expenseTypes;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ExpenseTypeResponse>> Handle(UpdateExpenseTypeCommand command, CancellationToken ct)
    {
        var expenseType = await _expenseTypes.GetTrackedByIdAsync(command.TenantId, command.ExpenseTypeId, ct).ConfigureAwait(false);
        if (expenseType is null)
        {
            return Result.Failure<ExpenseTypeResponse>(
                new Error("purchases.expense_type.not_found", "La categoría de compra no existe.", ErrorType.NotFound));
        }

        if (!expenseType.IsSystem && !string.IsNullOrWhiteSpace(command.Code))
        {
            if (await _expenseTypes.ExistsByCodeAsync(command.TenantId, command.Code, command.ExpenseTypeId, ct).ConfigureAwait(false))
            {
                return Result.Failure<ExpenseTypeResponse>(
                    new Error("purchases.expense_type.code_duplicate", "Ya existe otra categoría de compra con este código.", ErrorType.Conflict));
            }
        }

        var updateResult = expenseType.Update(
            command.Name,
            command.SriSustentoCode,
            command.AffectsInventory,
            command.SuggestedRetentionCode,
            command.RetentionPercentage,
            command.ValidFrom,
            command.ValidUntil,
            command.Description,
            command.Code,
            command.IsActive,
            command.UpdatedBy);

        if (updateResult.IsFailure)
        {
            return Result.Failure<ExpenseTypeResponse>(updateResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(ExpenseTypeResponse.FromDomain(expenseType));
    }
}
