using EcuNexo.Business.Abstractions;

namespace EcuNexo.Business.Pricing.Queries.ListPromotions;

public sealed record ListPromotionsQuery(Guid TenantId, bool OnlyActive = true)
    : IQuery<IReadOnlyList<PromotionResponse>>;
