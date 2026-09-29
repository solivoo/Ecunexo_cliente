using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics.Commands.UpdateShippingRateRule;

public sealed record UpdateShippingRateRuleCommand(
    Guid TenantId,
    Guid RuleId,
    UpdateShippingRateRuleInput Input) : ICommand<ShippingRateRuleDto>;

public sealed class UpdateShippingRateRuleHandler : ICommandHandler<UpdateShippingRateRuleCommand, ShippingRateRuleDto>
{
    private readonly ICallerContext _caller;
    private readonly IShippingRateRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateShippingRateRuleHandler(
        ICallerContext caller,
        IShippingRateRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _caller = caller;
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ShippingRateRuleDto>> Handle(
        UpdateShippingRateRuleCommand command,
        CancellationToken ct)
    {
        var rule = await _rules.GetTrackedByIdAsync(command.TenantId, command.RuleId, ct).ConfigureAwait(false);
        if (rule == null)
        {
            return Result.Failure<ShippingRateRuleDto>(
                new Error("logistics.shipping_rule.not_found", "No se encontró la regla de tarifa de envío solicitada.", ErrorType.NotFound));
        }

        var input = command.Input;
        var updateResult = rule.Update(
            input.Carrier,
            input.Zone,
            input.Name,
            input.Price,
            input.MinQuantity,
            input.MaxQuantity,
            input.MinOrderAmount,
            input.TaxRate,
            input.EstimatedDays,
            input.Notes,
            input.SortOrder,
            input.IsActive,
            _caller.UserId);

        if (updateResult.IsFailure)
        {
            return Result.Failure<ShippingRateRuleDto>(updateResult.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(MapToDto(rule));
    }

    private static ShippingRateRuleDto MapToDto(ShippingRateRule r) =>
        new(
            r.Id,
            r.TenantId,
            r.Carrier,
            r.Zone,
            r.Name,
            r.MinQuantity,
            r.MaxQuantity,
            r.MinOrderAmount,
            r.Price,
            r.TaxRate,
            r.EstimatedDays,
            r.Notes,
            r.SortOrder,
            r.IsActive,
            r.CreatedAt,
            r.UpdatedAt);
}
