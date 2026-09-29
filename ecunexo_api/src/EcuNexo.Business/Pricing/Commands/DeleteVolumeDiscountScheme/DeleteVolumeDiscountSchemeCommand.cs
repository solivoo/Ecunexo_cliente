using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Common;

namespace EcuNexo.Business.Pricing.Commands.DeleteVolumeDiscountScheme;

public sealed record DeleteVolumeDiscountSchemeCommand(Guid TenantId, Guid SchemeId)
    : ICommand<DeleteVolumeDiscountSchemeResponse>;

public sealed record DeleteVolumeDiscountSchemeResponse(Guid SchemeId, bool IsActive);

public sealed class DeleteVolumeDiscountSchemeHandler
    : ICommandHandler<DeleteVolumeDiscountSchemeCommand, DeleteVolumeDiscountSchemeResponse>
{
    private readonly ICallerContext _caller;
    private readonly IVolumeDiscountSchemeRepository _schemes;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteVolumeDiscountSchemeHandler(
        ICallerContext caller,
        IVolumeDiscountSchemeRepository schemes,
        IUnitOfWork unitOfWork)
    {
        _caller = caller;
        _schemes = schemes;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DeleteVolumeDiscountSchemeResponse>> Handle(
        DeleteVolumeDiscountSchemeCommand command,
        CancellationToken ct)
    {
        var scheme = await _schemes.GetTrackedByIdAsync(command.TenantId, command.SchemeId, ct).ConfigureAwait(false);
        if (scheme is null)
        {
            return Result.Failure<DeleteVolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.volume_scheme.not_found", "El esquema de descuento no existe.", ErrorType.NotFound));
        }

        scheme.SetActive(false, _caller.UserId);
        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return Result.Success(new DeleteVolumeDiscountSchemeResponse(scheme.Id, scheme.IsActive));
    }
}
