using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Logistics;

namespace EcuNexo.Business.Logistics.Queries.ResolveShippingRates;

public sealed record ResolveShippingRatesQuery(
    Guid TenantId,
    ResolveShippingRatesInput Input) : IQuery<IReadOnlyList<ResolvedShippingOptionDto>>;

public sealed class ResolveShippingRatesHandler : IQueryHandler<ResolveShippingRatesQuery, IReadOnlyList<ResolvedShippingOptionDto>>
{
    private readonly IShippingRateRuleRepository _rules;

    public ResolveShippingRatesHandler(IShippingRateRuleRepository rules)
    {
        _rules = rules;
    }

    public async Task<Result<IReadOnlyList<ResolvedShippingOptionDto>>> Handle(
        ResolveShippingRatesQuery query,
        CancellationToken ct)
    {
        var input = query.Input;
        var rules = await _rules.ListActiveForResolutionAsync(query.TenantId, input.Zone, ct).ConfigureAwait(false);

        var resolved = ShippingRateResolver.Resolve(rules, input.Zone, input.TotalQuantity, input.TotalOrderAmount);

        IReadOnlyList<ResolvedShippingOptionDto> response = resolved
            .Select(o => new ResolvedShippingOptionDto(
                o.RuleId,
                o.Carrier,
                o.Zone,
                o.Name,
                o.Price,
                o.TaxRate,
                o.TaxAmount,
                o.TotalPrice,
                o.EstimatedDays,
                o.Notes,
                o.IsEligible,
                o.UnitsNeeded,
                o.IsRecommended))
            .ToList();

        return Result.Success(response);
    }
}
