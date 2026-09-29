using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Logistics.Queries.ListShippingRateRules;

public sealed record ListShippingRateRulesQuery(
    Guid TenantId,
    string? Carrier = null,
    string? Zone = null,
    bool OnlyActive = false) : IQuery<IReadOnlyList<ShippingRateRuleDto>>;

public sealed class ListShippingRateRulesHandler : IQueryHandler<ListShippingRateRulesQuery, IReadOnlyList<ShippingRateRuleDto>>
{
    private readonly IShippingRateRuleRepository _rules;

    public ListShippingRateRulesHandler(IShippingRateRuleRepository rules)
    {
        _rules = rules;
    }

    public async Task<Result<IReadOnlyList<ShippingRateRuleDto>>> Handle(
        ListShippingRateRulesQuery query,
        CancellationToken ct)
    {
        var rules = await _rules.ListAsync(query.TenantId, query.Carrier, query.Zone, query.OnlyActive, ct).ConfigureAwait(false);

        IReadOnlyList<ShippingRateRuleDto> response = rules
            .Select(r => new ShippingRateRuleDto(
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
                r.UpdatedAt))
            .ToList();

        return Result.Success(response);
    }
}
