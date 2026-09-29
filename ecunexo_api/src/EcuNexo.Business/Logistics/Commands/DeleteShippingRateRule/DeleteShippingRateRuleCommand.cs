using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Logistics.Commands.DeleteShippingRateRule;

public sealed record DeleteShippingRateRuleCommand(
    Guid TenantId,
    Guid RuleId) : ICommand<bool>;

public sealed class DeleteShippingRateRuleHandler : ICommandHandler<DeleteShippingRateRuleCommand, bool>
{
    private readonly IShippingRateRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteShippingRateRuleHandler(
        IShippingRateRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(
        DeleteShippingRateRuleCommand command,
        CancellationToken ct)
    {
        var rule = await _rules.GetTrackedByIdAsync(command.TenantId, command.RuleId, ct).ConfigureAwait(false);
        if (rule == null)
        {
            return Result.Failure<bool>(
                new Error("logistics.shipping_rule.not_found", "No se encontró la regla de tarifa de envío solicitada.", ErrorType.NotFound));
        }

        _rules.Remove(rule);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(true);
    }
}
