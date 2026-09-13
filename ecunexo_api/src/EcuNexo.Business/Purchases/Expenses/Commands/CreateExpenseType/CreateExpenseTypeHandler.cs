using EcuNexo.Business.Abstractions;
using EcuNexo.Business.Purchases.Repositories;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Purchases;

namespace EcuNexo.Business.Purchases.Expenses.Commands.CreateExpenseType;

public sealed class CreateExpenseTypeHandler : ICommandHandler<CreateExpenseTypeCommand, ExpenseTypeResponse>
{
    private readonly IExpenseTypeRepository _expenseTypes;
    private readonly IIdGenerator _idGenerator;
    private readonly IUnitOfWork _unitOfWork;

    public CreateExpenseTypeHandler(
        IExpenseTypeRepository expenseTypes,
        IIdGenerator idGenerator,
        IUnitOfWork unitOfWork)
    {
        _expenseTypes = expenseTypes;
        _idGenerator = idGenerator;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ExpenseTypeResponse>> Handle(CreateExpenseTypeCommand command, CancellationToken ct)
    {
        if (await _expenseTypes.ExistsByCodeAsync(command.TenantId, command.Code, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<ExpenseTypeResponse>(
                new Error("purchases.expense_type.code_duplicate", "Ya existe un tipo de gasto con este código.", ErrorType.Conflict));
        }

        var result = ExpenseType.Create(
            _idGenerator.NewId(),
            command.TenantId,
            command.Code,
            command.Name,
            command.SriSustentoCode,
            command.AffectsInventory,
            isSystem: false,
            command.SuggestedRetentionCode,
            command.Description,
            command.CreatedBy);

        if (result.IsFailure)
        {
            return Result.Failure<ExpenseTypeResponse>(result.Error!);
        }

        var entity = result.Value!;
        await _expenseTypes.AddAsync(entity, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(ExpenseTypeResponse.FromDomain(entity));
    }
}
