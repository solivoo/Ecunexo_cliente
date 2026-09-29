using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics.Commands.CreateShippingRateRule;

public sealed record CreateShippingRateRuleCommand(
    Guid TenantId,
    CreateShippingRateRuleInput Input) : ICommand<ShippingRateRuleDto>;

public sealed class CreateShippingRateRuleHandler : ICommandHandler<CreateShippingRateRuleCommand, ShippingRateRuleDto>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IShippingRateRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public CreateShippingRateRuleHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IShippingRateRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<ShippingRateRuleDto>> Handle(
        CreateShippingRateRuleCommand command,
        CancellationToken ct)
    {
        var input = command.Input;
        var ruleId = _idGenerator.NewId();

        var created = ShippingRateRule.Create(
            ruleId,
            command.TenantId,
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
            _caller.UserId);

        if (created.IsFailure)
        {
            return Result.Failure<ShippingRateRuleDto>(created.Error!);
        }

        var rule = created.Value!;
        await _rules.AddAsync(rule, ct).ConfigureAwait(false);
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
