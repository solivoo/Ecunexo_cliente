using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.DeletePromotion;

public sealed record DeletePromotionCommand(Guid TenantId, Guid PromotionId) : ICommand<DeletePromotionResponse>;

public sealed record DeletePromotionResponse(Guid PromotionId, bool IsActive);

public sealed class DeletePromotionHandler : ICommandHandler<DeletePromotionCommand, DeletePromotionResponse>
{
    private readonly IPromotionRepository _promotions;
    private readonly ICallerContext _caller;
    private readonly IUnitOfWork _unitOfWork;

    public DeletePromotionHandler(
        IPromotionRepository promotions,
        ICallerContext caller,
        IUnitOfWork unitOfWork)
    {
        _promotions = promotions;
        _caller = caller;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeletePromotionResponse>> Handle(
        DeletePromotionCommand command,
        CancellationToken ct)
    {
        var promotion = await _promotions.GetTrackedByIdAsync(command.TenantId, command.PromotionId, ct)
            .ConfigureAwait(false);
        if (promotion is null)
        {
            return Result.Failure<DeletePromotionResponse>(
                new Error("catalog.pricing.promotion.not_found", "La promoción no existe.", ErrorType.NotFound));
        }

        promotion.SetActive(false, _caller.UserId);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new DeletePromotionResponse(promotion.Id, promotion.IsActive));
    }
}
