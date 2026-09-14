using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.RemisionGuides;

namespace EcuNexo.Business.RemisionGuides.Commands.UpdateRemisionGuideStatus;

public sealed record UpdateRemisionGuideStatusCommand(
    Guid TenantId,
    Guid GuideId,
    RemisionGuideStatus NewStatus,
    string? Reason = null,
    Guid? UserId = null) : ICommand<bool>;

public sealed class UpdateRemisionGuideStatusHandler : ICommandHandler<UpdateRemisionGuideStatusCommand, bool>
{
    private readonly IRemisionGuideRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateRemisionGuideStatusHandler(IRemisionGuideRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(UpdateRemisionGuideStatusCommand command, CancellationToken ct = default)
    {
        var guide = await _repository.GetByIdAsync(command.TenantId, command.GuideId, ct).ConfigureAwait(false);
        if (guide is null)
        {
            return Result.Failure<bool>(new Error("remision_guide.not_found", "La guía de remisión no existe.", ErrorType.NotFound));
        }

        switch (command.NewStatus)
        {
            case RemisionGuideStatus.InTransit:
                guide.MarkInTransit(command.UserId);
                break;
            case RemisionGuideStatus.Delivered:
                guide.MarkDelivered(command.UserId);
                break;
            case RemisionGuideStatus.Cancelled:
                guide.Cancel(command.Reason ?? "Anulada por el usuario", command.UserId);
                break;
            case RemisionGuideStatus.Authorized:
                if (string.IsNullOrWhiteSpace(guide.AuthorizationNumber))
                {
                    guide.MarkAuthorized(guide.AccessKey, DateTimeOffset.UtcNow, command.UserId);
                }
                break;
            case RemisionGuideStatus.Issued:
                guide.MarkIssued(command.UserId);
                break;
            default:
                return Result.Failure<bool>(new Error("remision_guide.status.unsupported", $"Transición de estado no soportada hacia '{command.NewStatus}'.", ErrorType.Validation));
        }

        await _repository.UpdateAsync(guide, ct).ConfigureAwait(false);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(true);
    }
}
