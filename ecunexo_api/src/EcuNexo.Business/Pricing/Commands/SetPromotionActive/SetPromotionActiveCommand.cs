using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.SetPromotionActive;

public sealed record SetPromotionActiveCommand(
    Guid TenantId,
    Guid PromotionId,
    bool IsActive) : ICommand<SetPromotionActiveResponse>;

public sealed record SetPromotionActiveResponse(Guid PromotionId, bool IsActive);

public sealed class SetPromotionActiveHandler
    : ICommandHandler<SetPromotionActiveCommand, SetPromotionActiveResponse>
{
    private readonly IPromotionRepository _promotions;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public SetPromotionActiveHandler(
        IPromotionRepository promotions,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _promotions = promotions;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<SetPromotionActiveResponse>> Handle(
        SetPromotionActiveCommand command,
        CancellationToken ct)
    {
        var promotion = await _promotions.GetTrackedByIdAsync(command.TenantId, command.PromotionId, ct)
            .ConfigureAwait(false);
        if (promotion is null)
        {
            return Result.Failure<SetPromotionActiveResponse>(
                new Error("catalog.pricing.promotion.not_found", "La promoción no existe.", ErrorType.NotFound));
        }

        var updated = promotion.SetActive(command.IsActive, _caller.UserId);
        if (updated.IsFailure)
        {
            return Result.Failure<SetPromotionActiveResponse>(updated.Error!);
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new SetPromotionActiveResponse(promotion.Id, promotion.IsActive));
    }
}
