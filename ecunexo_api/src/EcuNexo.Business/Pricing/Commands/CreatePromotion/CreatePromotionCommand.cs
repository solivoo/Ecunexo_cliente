using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.CreatePromotion;

public sealed record CreatePromotionCommand(
    Guid TenantId,
    string Code,
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    DateTimeOffset StartsAt,
    DateTimeOffset? EndsAt,
    int Priority,
    bool IsStackable,
    IReadOnlyList<PromotionTargetInput>? Targets = null) : ICommand<CreatePromotionResponse>;

public sealed record CreatePromotionResponse(Guid PromotionId, Guid TenantId);

public sealed class CreatePromotionHandler : ICommandHandler<CreatePromotionCommand, CreatePromotionResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IPromotionRepository _promotions;
    private readonly IUnitOfWork _unitOfWork;

    public CreatePromotionHandler(
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

    public async Task<Result<CreatePromotionResponse>> Handle(
        CreatePromotionCommand command,
        CancellationToken ct)
    {
        var normalizedCode = command.Code.Trim().ToUpperInvariant();
        if (await _promotions.CodeExistsAsync(command.TenantId, normalizedCode, null, ct).ConfigureAwait(false))
        {
            return Result.Failure<CreatePromotionResponse>(
                new Error("catalog.pricing.promotion.code.duplicate", "Ya existe una promoción con el mismo código.", ErrorType.Conflict));
        }

        var created = Promotion.Create(
            _idGenerator.NewId(),
            command.TenantId,
            normalizedCode,
            command.Name,
            command.Description,
            command.Type,
            command.Value,
            command.StartsAt,
            command.EndsAt,
            command.Priority,
            command.IsStackable,
            _caller.UserId);
        if (created.IsFailure)
        {
            return Result.Failure<CreatePromotionResponse>(created.Error!);
        }

        var promotion = created.Value!;
        if (command.Targets is { Count: > 0 })
        {
            foreach (var target in command.Targets)
            {
                var added = promotion.AddTarget(_idGenerator.NewId(), target.TargetType, target.TargetReference, _caller.UserId);
                if (added.IsFailure)
                {
                    return Result.Failure<CreatePromotionResponse>(added.Error!);
                }
            }
        }

        await _promotions.AddAsync(promotion, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new CreatePromotionResponse(promotion.Id, promotion.TenantId));
    }
}
