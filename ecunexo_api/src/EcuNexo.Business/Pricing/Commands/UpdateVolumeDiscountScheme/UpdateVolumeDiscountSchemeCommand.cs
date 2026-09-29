using EcuNexo.Business.Abstractions;
using EcuNexo.Core.Abstractions;
using EcuNexo.Core.Common;
using EcuNexo.Core.Pricing;

namespace EcuNexo.Business.Pricing.Commands.UpdateVolumeDiscountScheme;

public sealed record UpdateVolumeDiscountSchemeCommand(
    Guid TenantId,
    Guid SchemeId,
    string Name,
    string? Description,
    VolumeDiscountSchemeType Type,
    bool? IsActive,
    IReadOnlyList<VolumeDiscountTierInput>? Tiers = null) : ICommand<UpdateVolumeDiscountSchemeResponse>;

public sealed record UpdateVolumeDiscountSchemeResponse(Guid SchemeId, Guid TenantId);

public sealed class UpdateVolumeDiscountSchemeHandler : ICommandHandler<UpdateVolumeDiscountSchemeCommand, UpdateVolumeDiscountSchemeResponse>
{
    private readonly IIdGenerator _idGenerator;
    private readonly ICallerContext _caller;
    private readonly IVolumeDiscountSchemeRepository _schemes;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateVolumeDiscountSchemeHandler(
        IIdGenerator idGenerator,
        ICallerContext caller,
        IVolumeDiscountSchemeRepository schemes,
        IUnitOfWork unitOfWork)
    {
        _idGenerator = idGenerator;
        _caller = caller;
        _schemes = schemes;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<UpdateVolumeDiscountSchemeResponse>> Handle(
        UpdateVolumeDiscountSchemeCommand command,
        CancellationToken ct)
    {
        var scheme = await _schemes.GetTrackedByIdAsync(command.TenantId, command.SchemeId, ct).ConfigureAwait(false);
        if (scheme is null)
        {
            return Result.Failure<UpdateVolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.volume_scheme.not_found", "El esquema de descuento no existe.", ErrorType.NotFound));
        }

        var normalizedName = command.Name.Trim();
        if (await _schemes.NameExistsAsync(command.TenantId, normalizedName, scheme.Id, ct).ConfigureAwait(false))
        {
            return Result.Failure<UpdateVolumeDiscountSchemeResponse>(
                new Error("catalog.pricing.volume_scheme.name.duplicate", "Ya existe otro esquema con el mismo nombre.", ErrorType.Conflict));
        }

        var updateResult = scheme.Update(normalizedName, command.Description, command.Type, _caller.UserId);
        if (updateResult.IsFailure)
        {
            return Result.Failure<UpdateVolumeDiscountSchemeResponse>(updateResult.Error!);
        }

        if (command.IsActive.HasValue)
        {
            scheme.SetActive(command.IsActive.Value, _caller.UserId);
        }

        if (command.Tiers is not null)
        {
            scheme.ClearTiers(_caller.UserId);

            foreach (var tier in command.Tiers.OrderBy(t => t.QuantityFrom))
            {
                var tierResult = scheme.AddTier(
                    _idGenerator.NewId(),
                    tier.QuantityFrom,
                    tier.QuantityTo,
                    tier.Value,
                    _caller.UserId);

                if (tierResult.IsFailure)
                {
                    return Result.Failure<UpdateVolumeDiscountSchemeResponse>(tierResult.Error!);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        return Result.Success(new UpdateVolumeDiscountSchemeResponse(scheme.Id, scheme.TenantId));
    }
}
