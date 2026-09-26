using EcuNexo.Business.Pricing;
using EcuNexo.Business.Pricing.Commands.CreatePromotion;
using EcuNexo.Business.Pricing.Commands.UpdatePromotion;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Api.Contracts.V1.Pricing;

public sealed record PromotionTargetRequest(PromotionTargetType TargetType, string TargetReference);

public sealed record CreatePromotionRequest(
    string Code,
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    int Priority,
    bool IsStackable,
    IReadOnlyList<PromotionTargetRequest>? Targets)
{
    public CreatePromotionCommand ToCommand(Guid tenantId) =>
        new(
            tenantId,
            Code,
            Name,
            Description,
            Type,
            Value,
            StartsAt,
            EndsAt,
            Priority,
            IsStackable,
            Targets?.Select(t => new PromotionTargetInput(t.TargetType, t.TargetReference)).ToList());
}

public sealed record UpdatePromotionRequest(
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    int Priority,
    bool IsStackable,
    IReadOnlyList<PromotionTargetRequest>? Targets)
{
    public UpdatePromotionCommand ToCommand(Guid tenantId, Guid promotionId) =>
        new(
            tenantId,
            promotionId,
            Name,
            Description,
            Type,
            Value,
            StartsAt,
            EndsAt,
            Priority,
            IsStackable,
            Targets?.Select(t => new PromotionTargetInput(t.TargetType, t.TargetReference)).ToList());
}
