using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Queries.ListPromotions;

public sealed class ListPromotionsHandler
    : IQueryHandler<ListPromotionsQuery, IReadOnlyList<PromotionResponse>>
{
    private readonly IPromotionRepository _promotions;

    public ListPromotionsHandler(IPromotionRepository promotions)
    {
        _promotions = promotions;
    }

    public async Task<Result<IReadOnlyList<PromotionResponse>>> Handle(
        ListPromotionsQuery query,
        CancellationToken ct)
    {
        var promotions = await _promotions.ListAsync(query.TenantId, query.OnlyActive, ct).ConfigureAwait(false);
        IReadOnlyList<PromotionResponse> response = promotions
            .Select(p => new PromotionResponse(
                p.Id,
                p.Code,
                p.Name,
                p.Description,
                p.Type,
                p.Value,
                p.StartsAt,
                p.EndsAt,
                p.Priority,
                p.IsStackable,
                p.IsActive,
                p.Targets
                    .Select(t => new PromotionTargetResponse(t.TargetType, t.TargetReference))
                    .ToList()))
            .ToList();

        return Result.Success(response);
    }
}
