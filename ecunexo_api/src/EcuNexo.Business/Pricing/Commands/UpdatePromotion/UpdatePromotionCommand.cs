using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.UpdatePromotion;

public sealed record UpdatePromotionCommand(
    Guid TenantId,
    Guid PromotionId,
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    int Priority,
    bool IsStackable,
    IReadOnlyList<PromotionTargetInput>? Targets = null) : ICommand<UpdatePromotionResponse>;

public sealed record UpdatePromotionResponse(Guid PromotionId, Guid TenantId);

public sealed class UpdatePromotionHandler : ICommandHandler<UpdatePromotionCommand, UpdatePromotionResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPromotionRepository _promotions;
    private readonly IUnitOfWork _unitOfWork;

    public UpdatePromotionHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IPromotionRepository promotions,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _promotions = promotions;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdatePromotionResponse>> Handle(
        UpdatePromotionCommand command,
        CancellationToken ct)
    {
        var promotion = await _promotions.GetTrackedByIdAsync(command.TenantId, command.PromotionId, ct)
            .ConfigureAwait(false);
        if (promotion is null)
        {
            return Result.Failure<UpdatePromotionResponse>(
                new Error("catalog.pricing.promotion.not_found", "La promoción no existe.", ErrorType.NotFound));
        }

        var updated = promotion.Update(
            command.Name,
            command.Description,
            command.Type,
            command.Value,
            command.StartsAt,
            command.EndsAt,
            command.Priority,
            command.IsStackable,
            _caller.UserId);
        if (updated.IsFailure)
        {
            return Result.Failure<UpdatePromotionResponse>(updated.Error!);
        }

        if (command.Targets is not null)
        {
            foreach (var existing in promotion.Targets.ToList())
            {
                promotion.RemoveTarget(existing.Id, _caller.UserId);
            }

            foreach (var target in command.Targets)
            {
                var added = promotion.AddTarget(_idGenerator.NewId(), target.TargetType, target.TargetReference, _caller.UserId);
                if (added.IsFailure)
                {
                    return Result.Failure<UpdatePromotionResponse>(added.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdatePromotionResponse(promotion.Id, promotion.TenantId));
    }
}
